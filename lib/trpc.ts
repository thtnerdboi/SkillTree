// lib/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../backend/trpc/app-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const trpc = createTRPCReact<AppRouter>();

// Helper to get the userId from local storage to send to the server
const getUserId = async () => {
  try {
    const saved = await AsyncStorage.getItem("arcstep-state-v6");
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.userId;
    }
  } catch (e) {
    return null;
  }
  return null;
};

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: 'http://YOUR_LOCAL_IP_OR_RENDER_URL:3000/trpc', // Update this to your backend URL!
      async headers() {
        const userId = await getUserId();
        return {
          authorization: userId ? `Bearer ${userId}` : '',
        };
      },
    }),
  ],
});