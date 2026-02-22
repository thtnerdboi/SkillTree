import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// Go up TWO levels (../../) to get out of (tabs) and app folders
import { ErrorBoundary } from "../../components/ErrorBoundary"; 
import { AppStateProvider } from "../../state/app-state";
import { trpc, trpcClient } from "../../lib/trpc";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
        <AppStateProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <ErrorBoundary>
              <RootLayoutNav />
            </ErrorBoundary>
          </GestureHandlerRootView>
        </AppStateProvider>
      </trpc.Provider>
    </QueryClientProvider>
  );
}
