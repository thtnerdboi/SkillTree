import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AppRouter } from "@/backend/trpc/app-router";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  const RENDER_URL = "https://skilltree-backend-rff0.onrender.com";

  // 1. If we are in a built APK (via EAS), use the baked-in Environment Variable
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. If we are NOT in development mode (Production Build), use Render
  if (!__DEV__) {
    return RENDER_URL;
  }

  // 3. DEVELOPMENT MODE ONLY: Localhost/Emulator Fallbacks
  // Android emulators need 10.0.2.2 to see your computer's local port 3000
  return Platform.OS === "android" 
    ? "http://10.0.2.2:3000" 
    : "http://localhost:3000";
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