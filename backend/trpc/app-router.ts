import { createTRPCRouter } from "./create-context";
import { socialRouter } from "./routes/social";

export const appRouter = createTRPCRouter({
  social: socialRouter,
});

export type AppRouter = typeof appRouter;
