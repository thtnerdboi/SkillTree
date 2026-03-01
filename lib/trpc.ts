import { httpBatchLink } from "@trpc/client"; // Use httpBatchLink for better stability
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AppRouter } from "@/backend/trpc/app-router";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  // 1. If you defined an environment variable, use it
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;

  // 2. Android Emulators need this special IP to talk to your computer's localhost
  if (Platform.OS === "android") return "http://10.0.2.2:3000";

  // 3. iOS / Web / Default
  return "http://localhost:3000";
};

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      // 🔥 BUG 10 FIX: Actually send the userId so protectedProcedures work
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
          return {};
        }
        return {};
      },
    }),
  ],
});