import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { ErrorBoundary } from "../components/ErrorBoundary";
import { AppStateProvider } from "../state/app-state";
import { trpc, trpcClient } from "../lib/trpc";
import { MockStripeProvider } from "../lib/stripe"; // This handles the Pro upgrade logic

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/**
 * The Nav component handles the actual screen stacking.
 * It is separated so it can safely sit inside our Providers.
 */
function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back", headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Hide the splash screen once the app is ready
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        {/* 1. Stripe must wrap the state so we can trigger Pro upgrades */}
        <MockStripeProvider>
          {/* 2. AppStateProvider must wrap the UI so 'useAppState' works on every screen */}
          <AppStateProvider>
            {/* 3. GestureHandler enables the Skill Tree to be scrollable */}
            <GestureHandlerRootView style={{ flex: 1 }}>
              <ErrorBoundary>
                <RootLayoutNav />
              </ErrorBoundary>
            </GestureHandlerRootView>
          </AppStateProvider>
        </MockStripeProvider>
      </trpc.Provider>
    </QueryClientProvider>
  );
}