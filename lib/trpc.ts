import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AppRouter } from "@/backend/trpc/app-router";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  // 1. YOUR LIVE RENDER URL (Priority #1)
  // Replace this string with your actual Render URL if it differs
  const RENDER_URL = "https://skilltree-backend-rff0.onrender.com";

  // 2. Logic to choose the URL
  // If we are in a production build, ALWAYS use Render
  if (!__DEV__) {
    return RENDER_URL;
  }

  // 3. If in Development, try local fallbacks
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  
  // Use Render even in Dev if you want to test against the live DB, 
  // otherwise use the emulator IP
  return Platform.OS === "android" ? "http://10.0.2.2:3000" : RENDER_URL;
};

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      async headers() {
        try {
          const saved = await AsyncStorage.getItem("arcstep-state-v6");
          if (saved) {
            const parsed = JSON.parse(saved);
            return {
              authorization: `Bearer ${parsed.userId}`,
            };
          }
        } catch (e) {
          console.error("[tRPC] Header Error:", e);
          return {};
        }
        return {};
      },
    }),
  ],
});