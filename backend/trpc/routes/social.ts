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
          message:
            "No user found with that invite code. Make sure they have opened the app at least once.",
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
          message: "You can only view your own friend requests.",
        });
      }
      console.log("[social] getFriendRequests", input.userId);
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
    .input(
      z.object({
        userId: z.string().min(1),
        requestId: z.string().min(1),
      })
    )
    .mutation(({ input, ctx }) => {
      if (ctx.userId !== input.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only accept your own friend requests.",
        });
      }
      console.log("[social] acceptFriendRequest", input.userId, input.requestId);

      const request = storeApi
        .listFriendRequests(input.userId)
        .find((item) => item.id === input.requestId);
      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Friend request not found or already accepted.",
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
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only view your own circle.",
        });
      }
      console.log("[social] getCircleStats", input.userId);
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
      if (ctx.userId !== input.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only create a subscription for yourself.",
        });
      }
      console.log("[social] createSubscriptionIntent for", input.userId);

      const externalUrl = process.env.STRIPE_SUBSCRIPTION_INTENT_URL;
      const stripeSecret = process.env.STRIPE_SECRET_KEY;

      if (externalUrl) {
        const response = await fetch(externalUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: input.userId }),
        });
        if (!response.ok) {
          const text = await response.text();
          console.log("[social] External intent failed:", response.status, text);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Subscription service unavailable. Please try again.",
          });
        }
        const data = (await response.json()) as { clientSecret?: string };
        if (!data.clientSecret) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Subscription service returned no client secret.",
          });
        }
        return { clientSecret: data.clientSecret };
      }

      if (stripeSecret) {
        const body = new URLSearchParams();
        body.set("mode", "subscription");
        body.set("line_items[0][price]", process.env.STRIPE_PRICE_ID ?? "");
        body.set("line_items[0][quantity]", "1");
        body.set("success_url", process.env.STRIPE_SUCCESS_URL ?? "https://example.com/success");
        body.set("cancel_url", process.env.STRIPE_CANCEL_URL ?? "https://example.com/cancel");
        body.set("client_reference_id", input.userId);

        const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeSecret}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!response.ok) {
          const text = await response.text();
          console.log("[social] Stripe API error:", response.status, text);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Stripe session failed. Please try again.",
          });
        }

        const data = (await response.json()) as { id?: string; url?: string };
        if (!data.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Stripe session creation failed.",
          });
        }

        return { clientSecret: data.id };
      }

      console.log("[social] Stripe env missing; returning mock client secret");
      const mockClientSecret = `pi_mock_${Date.now()}_secret_${Math.random().toString(36).slice(2)}`;
      return { clientSecret: mockClientSecret };
    }),

  healthCheck: publicProcedure.query(() => ({
    status: "ok",
    timestamp: Date.now(),
  })),
});
