import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import PostHog from "posthog-react-native";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { ErrorBoundary } from "../components/ErrorBoundary";
import { RevenueCatProvider } from "../lib/revenuecat";
import { analytics } from "../utils/analytics";
import { AppStateProvider } from "../state/app-state";
import { trpc, trpcClient } from "../lib/trpc";

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back", headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    const posthogKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;

    if (posthogKey) {
      const posthog = new PostHog(posthogKey);

      analytics.configure({
        identify: (userId, traits) => posthog.identify(userId, traits),
        track: (event, properties) => posthog.capture(event, properties),
        reset: () => posthog.reset(),
      });
    }

    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <AppStateProvider>
          <RevenueCatProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <ErrorBoundary>
                <RootLayoutNav />
              </ErrorBoundary>
            </GestureHandlerRootView>
          </RevenueCatProvider>
        </AppStateProvider>
      </trpc.Provider>
    </QueryClientProvider>
  );
}
