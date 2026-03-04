import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./db/schema";

// 🕵️‍♂️ ULTRA DEBUG: Let's see exactly what's going on
const env = process.env;
const dbUrl = env.DATABASE_URL || env.DB_URL || env.POSTGRES_URL;

console.log("--- ENV DIAGNOSTICS ---");
console.log("DATABASE_URL present?", !!env.DATABASE_URL);
console.log("All Keys starting with 'DATA':", Object.keys(env).filter(k => k.startsWith('DATA')));
console.log("-----------------------");

if (!dbUrl) {
  // We'll throw a more descriptive error this time
  throw new Error(`CRITICAL: No connection string found. Keys detected: ${Object.keys(env).join(', ')}`);
}

const client = postgres(dbUrl, { prepare: false });
export const db = drizzle(client, { schema });

console.log("🐘 Database connection initialized!");