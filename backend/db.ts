import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./db/schema"; // Ensure this matches your schema folder

// 🔥 This pulled from your Render Environment Variables
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}

// Disable prefetch as it's not supported by Supabase's transaction mode/pooling
const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });

console.log("🐘 Postgres Connection Initialized");