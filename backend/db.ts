import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./db/schema";

// This will print a list of all variable names Render is passing to Node
console.log("🕵️‍♂️ Available ENV Keys:", Object.keys(process.env));

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}

const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });

console.log("🐘 Database connection initialized!");