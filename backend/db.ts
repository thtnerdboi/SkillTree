import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./db/schema";
import "dotenv/config"; // This is the key! It reads the .env file we just made on Render

const env = process.env;
// Check the environment variable first, then the .env file
const dbUrl = env.DATABASE_URL;

console.log("--- 🚨 FINAL DIAGNOSTIC 🚨 ---");
console.log("DATABASE_URL present in process.env?", !!dbUrl);

if (!dbUrl) {
  // If we get here, it means both the env var and the .env file failed
  throw new Error("CRITICAL: DATABASE_URL not found in env or .env file.");
}

const client = postgres(dbUrl, { prepare: false });
export const db = drizzle(client, { schema });

console.log("🐘 Database connection initialized via Secret File!");