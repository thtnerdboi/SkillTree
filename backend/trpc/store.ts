import { and, eq, or } from "drizzle-orm";
import { db } from "../db";
import { friends, users } from "../db/schema";

type UserInsert = typeof users.$inferInsert;
type FriendRow = typeof friends.$inferSelect;

export const storeApi = {
  // 1. Find a user by their ID or Invite Code
  async findUser(idOrInvite: string) {
    const result = await db
      .select()
      .from(users)
      .where(or(eq(users.id, idOrInvite), eq(users.inviteCode, idOrInvite)))
      .limit(1);
    return result[0] ?? null;
  },

  async getUser(id: string) {
    return this.findUser(id);
  },

  async findUserByInvite(inviteCode: string) {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.inviteCode, inviteCode))
      .limit(1);
    return result[0] ?? null;
  },

  // 2. Find a user specifically by Stripe Customer ID (for webhooks)
  async findUserByStripeId(stripeId: string) {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, stripeId))
      .limit(1);
    return result[0] ?? null;
  },

  // 3. The "Super Upsert" - Creates or Updates a user permanently
  async upsertUser(userData: UserInsert & { userId?: string }) {
    const id = userData.userId ?? userData.id;

    return await db
      .insert(users)
      .values({
        id,
        name: userData.name,
        inviteCode: userData.inviteCode,
        weeklyCompletion: userData.weeklyCompletion ?? 0,
        isPro: userData.isPro ?? false,
        stripeCustomerId: userData.stripeCustomerId ?? null,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          name: userData.name,
          inviteCode: userData.inviteCode,
          weeklyCompletion: userData.weeklyCompletion ?? 0,
          isPro: userData.isPro ?? false,
          stripeCustomerId: userData.stripeCustomerId ?? null,
        },
      });
  },

  async areFriends(userId: string, friendId: string) {
    const existing = await db
      .select({ id: friends.id })
      .from(friends)
      .where(
        and(
          eq(friends.userId, userId),
          eq(friends.friendId, friendId),
          eq(friends.status, "accepted")
        )
      )
      .limit(1);

    return existing.length > 0;
  },

  async addFriendRequest(fromUserId: string, toUserId: string) {
    const existing = await db
      .select()
      .from(friends)
      .where(
        and(
          eq(friends.userId, fromUserId),
          eq(friends.friendId, toUserId),
          eq(friends.status, "pending")
        )
      )
      .limit(1);

    if (existing[0]) return existing[0];

    const inserted = await db
      .insert(friends)
      .values({
        userId: fromUserId,
        friendId: toUserId,
        status: "pending",
      })
      .returning();

    return inserted[0];
  },

  async listFriendRequests(userId: string) {
    return await db
      .select()
      .from(friends)
      .where(and(eq(friends.friendId, userId), eq(friends.status, "pending")));
  },

  async removeFriendRequest(requestId: string | number) {
    const id = typeof requestId === "string" ? Number(requestId) : requestId;
    if (!Number.isFinite(id)) return;

    await db.delete(friends).where(eq(friends.id, id));
  },

  // 4. Friend Logic (Permanent DB records)
  async addFriend(userId: string, friendId: string) {
    const existing = await db
      .select()
      .from(friends)
      .where(
        and(
          eq(friends.userId, userId),
          eq(friends.friendId, friendId),
          eq(friends.status, "accepted")
        )
      )
      .limit(1);

    if (existing[0]) return existing[0];

    const inserted = await db
      .insert(friends)
      .values({
        userId,
        friendId,
        status: "accepted",
      })
      .returning();

    return inserted[0];
  },

  async addFriendship(userId: string, friendId: string) {
    await this.addFriend(userId, friendId);
    await this.addFriend(friendId, userId);
  },

  async listFriends(userId: string) {
    const accepted = await db
      .select({ friendId: friends.friendId })
      .from(friends)
      .where(and(eq(friends.userId, userId), eq(friends.status, "accepted")));

    return accepted
      .map((friend) => friend.friendId)
      .filter((friendId): friendId is string => Boolean(friendId));
  },

  async getFriends(userId: string) {
    // Logic to join users table with friends table to get display names
    const userFriends = await db
      .select({
        id: users.id,
        name: users.name,
        inviteCode: users.inviteCode,
        weeklyCompletion: users.weeklyCompletion,
      })
      .from(friends)
      .innerJoin(users, eq(friends.friendId, users.id))
      .where(and(eq(friends.userId, userId), eq(friends.status, "accepted")));

    return userFriends;
  },
};

export type FriendRequest = FriendRow;
