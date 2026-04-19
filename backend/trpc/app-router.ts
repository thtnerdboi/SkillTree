import { createTRPCRouter } from "./create-context";
import { socialRouter } from "./routes/social";
import { stripeRouter } from "./routes/stripe";
import { aiRouter } from "./routes/ai";
import { progressRouter } from "./routes/progress";

export const appRouter = createTRPCRouter({
  social: socialRouter,
  stripe: stripeRouter,
  ai: aiRouter,
  progress: progressRouter,
});

export type AppRouter = typeof appRouter;
