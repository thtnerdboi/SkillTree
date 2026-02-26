import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StripeProvider } from "@stripe/stripe-react-native";

import { ErrorBoundary } from "../components/ErrorBoundary";
import { AppStateProvider } from "../state/app-state";
import { trpc, trpcClient } from "../lib/trpc";

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

// StripeProvider lives here ONCE — wrapping everything.
// Having two nested StripeProviders breaks useStripe() context.
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
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <StripeProvider
          publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""}
          merchantIdentifier="merchant.com.arcstep.skilltree"
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