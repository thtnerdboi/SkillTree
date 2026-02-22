import { Tabs } from "expo-router";

// FIX: The original file was a copy of the root layout (app/layout.tsx) placed
// incorrectly inside (tabs). This caused a recursive Stack.Screen "(tabs)" inside
// the (tabs) folder itself, and duplicated all providers.
//
// This file should only define the Tab navigator for the (tabs) group.
// All providers (QueryClient, tRPC, AppState, GestureHandler, ErrorBoundary)
// live in app/layout.tsx where they belong.

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}>
      <Tabs.Screen name="index" options={{ headerShown: false }} />
    </Tabs>
  );
}