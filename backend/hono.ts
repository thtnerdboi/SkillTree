import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";

import { appRouter } from "./trpc/app-router";
import { webhookRouter } from './trpc/routes/stripe-webhook';
import { createContext } from "./trpc/create-context";

const app = new Hono();

// CORS should go at the very top so all routes are protected
app.use("*", cors());

// Webhook mounted securely before tRPC
app.route('/api/webhooks', webhookRouter);

// 🔥 FIX 1: Match the route to the endpoint perfectly
app.use(
  "/api/trpc/*", 
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  })
);

app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running" });
});

// 🔥 FIX 2: Let Render decide the port, fallback to 3000 for local
const port = process.env.PORT ? Number(process.env.PORT) : 3000;
console.log(`Server is running on port ${port}`);

// hostname "0.0.0.0" is correct! Leave it!
serve({
  fetch: app.fetch,
  port,
  hostname: "0.0.0.0"
});

export default app;