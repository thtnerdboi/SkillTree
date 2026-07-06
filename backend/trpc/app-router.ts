import { createTRPCRouter } from "./create-context";
import { socialRouter } from "./routes/social";
import { aiRouter } from "./routes/ai";
import { progressRouter } from "./routes/progress";

export const appRouter = createTRPCRouter({
  social: socialRouter,
  ai: aiRouter,
  progress: progressRouter,
});

export type AppRouter = typeof appRouter;
