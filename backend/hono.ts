import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";

import { appRouter } from "./trpc/app-router";
import { webhookRouter } from './trpc/routes/stripe-webhook';
import { createContext } from "./trpc/create-context";

import 'dotenv/config';
import { trpcServer } from "@hono/trpc-server";

const app = new Hono();

// CORS is critical for Stripe/tRPC communication
app.use("*", cors());

app.route('/api/webhooks', webhookRouter);

app.use(
  "/api/trpc/*", 
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  })
);

app.get("/", (c) => {
  return c.json({ status: "ok", message: "SkillTree API is running" });
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

// 🔥 This ensures the server is reachable by the emulator
serve({
  fetch: app.fetch,
  port,
  hostname: "0.0.0.0" 
}, (info) => {
  console.log(`\n🚀 SERVER LIVE: http://localhost:${info.port}`);
  console.log(`📱 ANDROID EMULATOR REACHABLE AT: http://10.0.2.2:${info.port}/api/trpc\n`);
});

export default app;