import { httpLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import type { AppRouter } from "@/backend/trpc/app-router";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  // If you deploy your backend later, you can put the real URL in your .env file
  // For now, we point it to your local machine!
  return process.env.EXPO_PUBLIC_API_URL || "https://skilltree-backend-rff0.onrender.com";
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
    }),
  ],
});