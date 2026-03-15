import { createTRPCRouter } from "./create-context";
import { socialRouter } from "./routes/social";
import { stripeRouter } from "./routes/stripe"; // Add this
import { aiRouter } from "./routes/ai";         // Add this

export const appRouter = createTRPCRouter({
  social: socialRouter,
  stripe: stripeRouter, // Add this
  ai: aiRouter,         // Add this
});

export type AppRouter = typeof appRouter;