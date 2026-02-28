import { TRPCError } from "@trpc/server";
import * as z from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "../create-context";
import { storeApi } from "../store";

export const socialRouter = createTRPCRouter({
  upsertUser: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        name: z.string().min(1).max(64),
        inviteCode: z.string().min(1).max(32),
        weeklyCompletion: z.number().min(0).max(100),
      })
    )
    .mutation(({ input, ctx }) => {
      if (ctx.userId !== input.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only update your own profile." });
      }
      console.log("[social] upsertUser", input.userId);
      return storeApi.upsertUser({
        id: input.userId,
        name: input.name,
        inviteCode: input.inviteCode,
        weeklyCompletion: input.weeklyCompletion,
        updatedAt: Date.now(),
      });
    }),

  sendFriendRequest: protectedProcedure
    .input(z.object({ fromUserId: z.string().min(1), toInviteCode: z.string().min(1) }))
    .mutation(({ input, ctx }) => {
      if (ctx.userId !== input.fromUserId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only send requests as yourself." });
      }
      const toUser = storeApi.findUserByInvite(input.toInviteCode);
      if (!toUser) throw new TRPCError({ code: "NOT_FOUND", message: "No user found with that invite code." });
      if (toUser.id === input.fromUserId) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot add yourself." });
      if (storeApi.areFriends(input.fromUserId, toUser.id)) return { status: "already_friends" } as const;
      const existing = storeApi.listFriendRequests(toUser.id).find((r) => r.fromUserId === input.fromUserId);
      if (existing) return { status: "already_pending" } as const;
      const request = storeApi.addFriendRequest(input.fromUserId, toUser.id);
      return { status: "requested", requestId: request.id } as const;
    }),

  getFriendRequests: protectedProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(({ input, ctx }) => {
      if (ctx.userId !== input.userId) throw new TRPCError({ code: "FORBIDDEN" });
      return storeApi.listFriendRequests(input.userId).map((request) => {
        const fromUser = storeApi.getUser(request.fromUserId);
        return {
          id: request.id,
          fromUserId: request.fromUserId,
          fromName: fromUser?.name ?? "Unknown",
          fromInviteCode: fromUser?.inviteCode ?? "",
          createdAt: request.createdAt,
        };
      });
    }),

  acceptFriendRequest: protectedProcedure
    .input(z.object({ userId: z.string().min(1), requestId: z.string().min(1) }))
    .mutation(({ input, ctx }) => {
      if (ctx.userId !== input.userId) throw new TRPCError({ code: "FORBIDDEN" });
      const request = storeApi.listFriendRequests(input.userId).find((item) => item.id === input.requestId);
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found." });
      storeApi.addFriendship(request.fromUserId, request.toUserId);
      storeApi.removeFriendRequest(request.id);
      return { status: "accepted" } as const;
    }),

  getCircleStats: protectedProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(({ input, ctx }) => {
      if (ctx.userId !== input.userId) throw new TRPCError({ code: "FORBIDDEN" });
      const friendIds = storeApi.listFriends(input.userId);
      const ids = [input.userId, ...friendIds];
      return ids
        .map((id) => storeApi.getUser(id))
        .filter((user): user is NonNullable<typeof user> => Boolean(user))
        .map((user) => ({
          userId: user.id,
          name: user.name,
          inviteCode: user.inviteCode,
          weeklyCompletion: user.weeklyCompletion,
        }));
    }),

  createSubscriptionIntent: protectedProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const stripeSecret = process.env.STRIPE_SECRET_KEY;
      const priceId = process.env.STRIPE_MONTHLY_PRICE_ID;

      // --- DEV / MISSING KEY FALLBACK ---
      if (!stripeSecret || !priceId) {
        console.warn("⚠️ Stripe key or Price ID missing — returning mock client secret");
        return {
          clientSecret: `pi_mock_${Date.now()}_secret_${Math.random().toString(36).slice(2)}`,
          ephemeralKey: 'mock_ephemeral_key',
          customer: 'mock_customer_id',
        };
      }

      console.log("[social] Processing Stripe intent for user:", input.userId);

      // 1. Fetch user from store
      const user = storeApi.getUser(input.userId);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User must exist in database to create a subscription." });
      }

      let customerId = user.stripeCustomerId;

      // 2. Create Stripe Customer ONLY if they don't have one
      if (!customerId) {
        console.log("[social] Creating new Stripe Customer...");
        const customerRes = await fetch("https://api.stripe.com/v1/customers", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeSecret}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            "metadata[userId]": input.userId,
            description: `SkillTree user ${input.userId}`,
          }).toString(),
        });
        
        const customerData = await customerRes.json();
        if (customerData.error) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: customerData.error.message });
        }
        
        customerId = customerData.id;

        // Save the ID back to the user in the database so we reuse it next time!
        storeApi.upsertUser({
          ...user,
          stripeCustomerId: customerId,
        });
      } else {
        console.log("[social] Found existing Stripe Customer! Reusing:", customerId);
      }

      // 3. Create Ephemeral Key (Required for mobile PaymentSheet)
      const ephemeralRes = await fetch("https://api.stripe.com/v1/ephemeral_keys", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecret}`,
          "Stripe-Version": "2023-10-16", // Ensure this matches your app's version
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          customer: customerId as string,
        }).toString(),
      });
      const ephemeralData = await ephemeralRes.json();

      // 4. Create the Subscription
      const subRes = await fetch("https://api.stripe.com/v1/subscriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecret}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          customer: customerId as string,
          "items[0][price]": priceId,
          payment_behavior: "default_incomplete",
          "expand[]": "latest_invoice.payment_intent",
        }).toString(),
      });
      
      const subscription = await subRes.json();
      if (subscription.error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: subscription.error.message });
      }

      const clientSecret = subscription?.latest_invoice?.payment_intent?.client_secret;

      if (!clientSecret) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe did not return a client secret.",
        });
      }

      console.log("✅ Subscription intent ready");
      
      // 5. Return everything the mobile PaymentSheet needs
      return { 
        clientSecret,
        ephemeralKey: ephemeralData.secret,
        customer: customerId 
      };
    }),

  healthCheck: publicProcedure.query(() => ({
    status: "ok",
    timestamp: Date.now(),
  })),
});