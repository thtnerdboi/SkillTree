import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { ErrorBoundary } from "../components/ErrorBoundary";
import { AppStateProvider } from "../state/app-state";
import { trpc, trpcClient } from "../lib/trpc";
// 1. IMPORT THE REAL STRIPE PROVIDER
import { StripeProvider } from "@stripe/stripe-react-native"; 

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

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
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        {/* 2. USE THE REAL STRIPE PROVIDER WITH YOUR PUBLISHABLE KEY */}
        <StripeProvider 
          publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || "pk_test_YOUR_KEY_HERE"}
        >
          <AppStateProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <ErrorBoundary>
                <RootLayoutNav />
              </ErrorBoundary>
            </GestureHandlerRootView>
          </AppStateProvider>
        </StripeProvider>
      </trpc.Provider>
    </QueryClientProvider>
  );
}