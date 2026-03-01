import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

// 👤 Users Table
export const users = pgTable("users", {
  id: text("id").primaryKey(), // The usr_... ID from your app
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  weeklyCompletion: integer("weekly_completion").default(0),
  isPro: boolean("is_pro").default(false),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 👥 Friends Table (The Junction)
export const friends = pgTable("friends", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: text("user_id").references(() => users.id),
  friendId: text("friend_id").references(() => users.id),
  status: text("status").default("accepted"), // 'pending', 'accepted'
  createdAt: timestamp("created_at").defaultNow(),
});