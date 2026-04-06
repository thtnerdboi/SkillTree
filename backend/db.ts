import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./db/schema";
import "dotenv/config";

const env = process.env;
const dbUrl = env.DATABASE_URL;

if (!dbUrl) {
  throw new Error("DATABASE_URL is required to start the backend.");
}

const client = postgres(dbUrl, { prepare: false });
export const db = drizzle(client, { schema });
