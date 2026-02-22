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
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only update your own profile.",
        });
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
    .input(
      z.object({
        fromUserId: z.string().min(1),
        toInviteCode: z.string().min(1),
      })
    )
    .mutation(({ input, ctx }) => {
      if (ctx.userId !== input.fromUserId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only send requests as yourself.",
        });
      }
      console.log("[social] sendFriendRequest", input.fromUserId, input.toInviteCode);
      const toUser = storeApi.findUserByInvite(input.toInviteCode);
      if (!toUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No user found with that invite code.",
        });
      }
      if (toUser.id === input.fromUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot add yourself.",
        });
      }
      if (storeApi.areFriends(input.fromUserId, toUser.id)) {
        return { status: "already_friends" } as const;
      }
      const existing = storeApi
        .listFriendRequests(toUser.id)
        .find((r) => r.fromUserId === input.fromUserId);
      if (existing) {
        return { status: "already_pending" } as const;
      }
      const request = storeApi.addFriendRequest(input.fromUserId, toUser.id);
      return { status: "requested", requestId: request.id } as const;
    }),

  getFriendRequests: protectedProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(({ input, ctx }) => {
      if (ctx.userId !== input.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only view your own requests.",
        });
      }
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
      if (ctx.userId !== input.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only accept your own requests.",
        });
      }
      const request = storeApi
        .listFriendRequests(input.userId)
        .find((item) => item.id === input.requestId);
      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found.",
        });
      }
      storeApi.addFriendship(request.fromUserId, request.toUserId);
      storeApi.removeFriendRequest(request.id);
      return { status: "accepted" } as const;
    }),

  getCircleStats: protectedProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(({ input, ctx }) => {
      if (ctx.userId !== input.userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
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

      if (!stripeSecret) {
        console.log("⚠️ Stripe key missing; returning mock secret");
        const mockClientSecret = `pi_mock_${Date.now()}_secret_${Math.random().toString(36).slice(2)}`;
        return { clientSecret: mockClientSecret };
      }

      console.log("[social] Calling Stripe for user:", input.userId);

      const response = await fetch("https://api.stripe.com/v1/payment_intents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecret}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          amount: "599", // Charging 599 pence (£5.99)
          currency: "gbp",
          "metadata[userId]": input.userId,
          "payment_method_types[]": "card",
        }).toString(),
      });

      const data = await response.json();

      if (data.error) {
        console.log("❌ STRIPE ERROR:", data.error.message);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: data.error.message,
        });
      }

      console.log("✅ SUCCESS: Client Secret created");
      return { clientSecret: data.client_secret };
    }),

  healthCheck: publicProcedure.query(() => ({
    status: "ok",
    timestamp: Date.now(),
  })),
});