import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { ErrorBoundary } from "../components/ErrorBoundary";
import { RevenueCatProvider } from "../lib/revenuecat";
import { AppStateProvider } from "../state/app-state";
import { trpc, trpcClient } from "../lib/trpc";

SplashScreen.preventAutoHideAsync();

const NOTIFICATION_PERMISSION_KEY = "skilltree.notifications.permissionGranted";
const DAILY_NOTIFICATION_ID_KEY = "skilltree.notifications.dailyStreakId";
const DAILY_NOTIFICATION_CHANNEL_ID = "daily-streak-reminders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const queryClient = new QueryClient();

async function ensureNotificationChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(DAILY_NOTIFICATION_CHANNEL_ID, {
    name: "Daily streak reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function requestNotificationPermissionOnce(): Promise<boolean> {
  const storedPermission = await AsyncStorage.getItem(NOTIFICATION_PERMISSION_KEY);

  if (storedPermission !== null) {
    return storedPermission === "true";
  }

  await ensureNotificationChannel();
  const { granted } = await Notifications.requestPermissionsAsync();
  await AsyncStorage.setItem(NOTIFICATION_PERMISSION_KEY, granted ? "true" : "false");

  return granted;
}

async function rescheduleDailyStreakNotification() {
  const granted = await requestNotificationPermissionOnce();

  if (!granted) {
    return;
  }

  await ensureNotificationChannel();

  const existingNotificationId = await AsyncStorage.getItem(DAILY_NOTIFICATION_ID_KEY);
  if (existingNotificationId) {
    await Notifications.cancelScheduledNotificationAsync(existingNotificationId).catch(
      () => undefined
    );
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: "SkillTree",
      body: "Don't break your streak — your skill tree is waiting.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
      channelId: DAILY_NOTIFICATION_CHANNEL_ID,
    },
  });

  await AsyncStorage.setItem(DAILY_NOTIFICATION_ID_KEY, notificationId);
}

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
    const syncNotifications = () => {
      rescheduleDailyStreakNotification().catch((error) => {
        console.warn("[notifications] Failed to schedule daily reminder", error);
      });
    };

    syncNotifications();

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        syncNotifications();
      }
    });

    SplashScreen.hideAsync();

    return () => {
      subscription.remove();
    };
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
