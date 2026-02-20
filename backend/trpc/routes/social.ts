import * as z from "zod";

import { createTRPCRouter, publicProcedure } from "../create-context";
import { storeApi } from "../store";

export const socialRouter = createTRPCRouter({
  upsertUser: publicProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        name: z.string().min(1),
        inviteCode: z.string().min(1),
        weeklyCompletion: z.number().min(0).max(100),
      })
    )
    .mutation(({ input }) => {
      console.log("[social] upsertUser", input.userId);
      return storeApi.upsertUser({
        id: input.userId,
        name: input.name,
        inviteCode: input.inviteCode,
        weeklyCompletion: input.weeklyCompletion,
        updatedAt: Date.now(),
      });
    }),
  sendFriendRequest: publicProcedure
    .input(
      z.object({
        fromUserId: z.string().min(1),
        toInviteCode: z.string().min(1),
      })
    )
    .mutation(({ input }) => {
      console.log("[social] sendFriendRequest", input.fromUserId, input.toInviteCode);
      const toUser = storeApi.findUserByInvite(input.toInviteCode);
      if (!toUser) {
        throw new Error("User not found for invite code");
      }
      if (toUser.id === input.fromUserId) {
        throw new Error("Cannot add yourself");
      }
      if (storeApi.areFriends(input.fromUserId, toUser.id)) {
        return { status: "already_friends" } as const;
      }
      const existing = storeApi
        .listFriendRequests(toUser.id)
        .find((request) => request.fromUserId === input.fromUserId);
      if (existing) {
        return { status: "already_pending" } as const;
      }
      const request = storeApi.addFriendRequest(input.fromUserId, toUser.id);
      return { status: "requested", requestId: request.id } as const;
    }),
  getFriendRequests: publicProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(({ input }) => {
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
  acceptFriendRequest: publicProcedure
    .input(z.object({ userId: z.string().min(1), requestId: z.string().min(1) }))
    .mutation(({ input }) => {
      console.log("[social] acceptFriendRequest", input.userId, input.requestId);
      const request = storeApi
        .listFriendRequests(input.userId)
        .find((item) => item.id === input.requestId);
      if (!request) {
        throw new Error("Friend request not found");
      }
      storeApi.addFriendship(request.fromUserId, request.toUserId);
      storeApi.removeFriendRequest(request.id);
      return { status: "accepted" } as const;
    }),
  getCircleStats: publicProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(({ input }) => {
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
});
