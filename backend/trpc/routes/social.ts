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
    .mutation(async ({ input, ctx }) => {
      if (ctx.userId !== input.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only update your own profile." });
      }
      console.log("[social] upsertUser", input.userId);
      
      const existing = await storeApi.getUser(input.userId);
      const isPro = existing ? existing.isPro : false;
      const stripeCustomerId = existing ? existing.stripeCustomerId : null;

      return await storeApi.upsertUser({
        id: input.userId,
        name: input.name,
        inviteCode: input.inviteCode,
        weeklyCompletion: input.weeklyCompletion,
        isPro,
        stripeCustomerId
      });
    }),

  getUser: protectedProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      if (ctx.userId !== input.userId) throw new TRPCError({ code: "FORBIDDEN" });
      return await storeApi.getUser(input.userId);
    }),

  sendFriendRequest: protectedProcedure
    .input(z.object({ fromUserId: z.string().min(1), toInviteCode: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.userId !== input.fromUserId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only send requests as yourself." });
      }
      const toUser = await storeApi.findUserByInvite(input.toInviteCode);
      if (!toUser) throw new TRPCError({ code: "NOT_FOUND", message: "No user found with that invite code." });
      if (toUser.id === input.fromUserId) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot add yourself." });
      
      const areFriends = await storeApi.areFriends(input.fromUserId, toUser.id);
      if (areFriends) return { status: "already_friends" } as const;
      
      const requests = await storeApi.listFriendRequests(toUser.id);
      const existing = requests.find((r) => r.userId === input.fromUserId);
      if (existing) return { status: "already_pending" } as const;
      
      const request = await storeApi.addFriendRequest(input.fromUserId, toUser.id);
      return { status: "requested", requestId: request.id } as const;
    }),

  getFriendRequests: protectedProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      if (ctx.userId !== input.userId) throw new TRPCError({ code: "FORBIDDEN" });
      const requests = await storeApi.listFriendRequests(input.userId);
      return await Promise.all(
        requests.map(async (request) => {
          const fromUser = request.userId ? await storeApi.getUser(request.userId) : null;
          return {
            id: request.id,
            fromUserId: request.userId ?? "",
            fromName: fromUser?.name ?? "Unknown",
            fromInviteCode: fromUser?.inviteCode ?? "",
            createdAt: request.createdAt,
          };
        })
      );
    }),

  acceptFriendRequest: protectedProcedure
    .input(z.object({ userId: z.string().min(1), requestId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.userId !== input.userId) throw new TRPCError({ code: "FORBIDDEN" });
      const requests = await storeApi.listFriendRequests(input.userId);
      const request = requests.find((item) => `${item.id}` === input.requestId);
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found." });
      
      if (!request.userId || !request.friendId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Request is missing friend details." });
      }

      await storeApi.addFriendship(request.userId, request.friendId);
      await storeApi.removeFriendRequest(request.id);
      return { status: "accepted" } as const;
    }),

  getCircleStats: protectedProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      if (ctx.userId !== input.userId) throw new TRPCError({ code: "FORBIDDEN" });
      const friendIds = await storeApi.listFriends(input.userId);
      const ids = [input.userId, ...friendIds];
      
      const users = await Promise.all(ids.map(id => storeApi.getUser(id)));
      
      return users
        .filter((user): user is NonNullable<typeof user> => Boolean(user))
        .map((user) => ({
          userId: user.id,
          name: user.name,
          inviteCode: user.inviteCode,
          weeklyCompletion: user.weeklyCompletion ?? 0,
          isPro: user.isPro,
        }))
        .sort((a, b) => b.weeklyCompletion - a.weeklyCompletion);
    }),

  createSubscriptionIntent: protectedProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.userId !== input.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only subscribe as yourself." });
      }

      const stripeSecret = process.env.STRIPE_SECRET_KEY;
      const priceId = process.env.STRIPE_MONTHLY_PRICE_ID;

      if (!stripeSecret || !priceId) {
        console.warn("⚠️ Stripe key or Price ID missing — returning mock client secret");
        return {
          clientSecret: `pi_mock_${Date.now()}_secret_${Math.random().toString(36).slice(2)}`,
          ephemeralKey: 'mock_ephemeral_key',
          customer: 'mock_customer_id',
        };
      }

      console.log("[social] Processing Stripe intent for user:", input.userId);

      const postStripeForm = async <T = any>(
        path: string,
        body: URLSearchParams,
        extraHeaders?: Record<string, string>
      ): Promise<T> => {
        const res = await fetch(`https://api.stripe.com/v1/${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeSecret}`,
            "Content-Type": "application/x-www-form-urlencoded",
            ...(extraHeaders ?? {}),
          },
          body: body.toString(),
        });

        const data = await res.json();
        if (!res.ok || data?.error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: data?.error?.message ?? `Stripe request failed for ${path}.`,
          });
        }
        return data as T;
      };

      const user = await storeApi.getUser(input.userId);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User must exist in database to create a subscription." });
      }

      let customerId = user.stripeCustomerId;

      if (!customerId) {
        console.log("[social] Creating new Stripe Customer...");
        const customerData = await postStripeForm<{ id: string }>(
          "customers",
          new URLSearchParams({
            "metadata[userId]": input.userId,
            description: `SkillTree user ${input.userId}`,
          })
        );
        
        customerId = customerData.id;

        await storeApi.upsertUser({
          ...user,
          stripeCustomerId: customerId,
        });
      }

      const ephemeralData = await postStripeForm<{ secret?: string }>(
        "ephemeral_keys",
        new URLSearchParams({
          customer: customerId as string,
        }),
        { "Stripe-Version": "2023-10-16" }
      );

      const subscription = await postStripeForm<any>(
        "subscriptions",
        new URLSearchParams({
          customer: customerId as string,
          "items[0][price]": priceId,
          payment_behavior: "default_incomplete",
          "expand[]": "latest_invoice.payment_intent",
        })
      );

      const clientSecret = subscription?.latest_invoice?.payment_intent?.client_secret;
      const ephemeralKey = ephemeralData?.secret;

      if (!clientSecret || !ephemeralKey) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe did not return complete payment sheet data.",
        });
      }

      console.log("✅ Subscription intent ready");
      
      return { 
        clientSecret,
        ephemeralKey,
        customer: customerId 
      };
    }),

  healthCheck: publicProcedure.query(() => ({
    status: "ok",
    timestamp: Date.now(),
  }))
});
