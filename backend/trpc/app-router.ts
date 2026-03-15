import { router } from "./store";
import { socialRouter } from "./routes/social";
import { stripeRouter } from "./routes/stripe";
import { aiRouter } from "./routes/ai"; // <-- 1. Import the new route

export const appRouter = router({
  social: socialRouter,
  stripe: stripeRouter,
  ai: aiRouter, // <-- 2. Add it to the main tree
});

export type AppRouter = typeof appRouter;