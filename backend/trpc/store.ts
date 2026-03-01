import { db } from "../db"; // Ensure you have a db.ts that exports your drizzle instance
import { users, friends } from "../db/schema"; // Your Drizzle schema files
import { eq, or, and } from "drizzle-orm";

export const storeApi = {
  // 1. Find a user by their ID or Invite Code
  async findUser(idOrInvite: string) {
    const result = await db
      .select()
      .from(users)
      .where(or(eq(users.id, idOrInvite), eq(users.inviteCode, idOrInvite)))
      .limit(1);
    return result[0] || null;
  },

  // 2. Find a user specifically by Stripe Customer ID (for webhooks)
  async findUserByStripeId(stripeId: string) {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, stripeId))
      .limit(1);
    return result[0] || null;
  },

  // 3. The "Super Upsert" - Creates or Updates a user permanently
  async upsertUser(userData: any) {
    return await db
      .insert(users)
      .values({
        id: userData.userId || userData.id,
        name: userData.name,
        inviteCode: userData.inviteCode,
        weeklyCompletion: userData.weeklyCompletion ?? 0,
        isPro: userData.isPro ?? false,
        stripeCustomerId: userData.stripeCustomerId,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          name: userData.name,
          weeklyCompletion: userData.weeklyCompletion,
          isPro: userData.isPro,
          stripeCustomerId: userData.stripeCustomerId,
        },
      });
  },

  // 4. Friend Logic (Permanent DB records)
  async addFriend(userId: string, friendId: string) {
    return await db.insert(friends).values({
      userId,
      friendId,
      status: 'accepted'
    });
  },

  async getFriends(userId: string) {
    // Logic to join users table with friends table to get display names
    const userFriends = await db
      .select({
        id: users.id,
        name: users.name,
        weeklyCompletion: users.weeklyCompletion,
      })
      .from(friends)
      .innerJoin(users, eq(friends.friendId, users.id))
      .where(eq(friends.userId, userId));
    
    return userFriends;
  }
};