import { Tabs } from "expo-router";
import { Home, User, Users } from "lucide-react-native";
import React from "react";
import { Platform, View } from "react-native";
import { BlurView } from "expo-blur";

import Colors from "../../constants/colors";

function TabIcon({
  focused,
  color,
  Icon,
}: {
  focused: boolean;
  color: string;
  Icon: React.ComponentType<{ color: string; size?: number; strokeWidth?: number }>;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        minWidth: 34,
        transform: [{ scale: focused ? 1.06 : 1 }],
        opacity: focused ? 1 : 0.9,
      }}
    >
      <View
        style={{
          padding: 8,
          borderRadius: 999,
          backgroundColor: focused ? "rgba(93,225,255,0.12)" : "transparent",
        }}
      >
        <Icon color={color} size={22} strokeWidth={2.2} />
      </View>
      <View
        style={{
          marginTop: 4,
          width: 5,
          height: 5,
          borderRadius: 2.5,
          backgroundColor: focused ? color : "transparent",
          opacity: focused ? 1 : 0,
        }}
      />
    </View>
  );
}

const tabBarGlassStyle = {
  flex: 1,
  borderRadius: 32,
  overflow: "hidden" as const,
  backgroundColor: "rgba(8,13,26,0.68)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.1)",
};

function TabBarGlass() {
  if (Platform.OS === "android") {
    return <View style={[tabBarGlassStyle, { backgroundColor: "#0d1120" }]} />;
  }

  return <BlurView tint="dark" intensity={80} style={tabBarGlassStyle} />;
}

const tabBarStyle = {
  position: "absolute" as const,
  bottom: 24,
  left: 24,
  right: 24,
  marginHorizontal: 24,
  height: 64,
  borderRadius: 32,
  backgroundColor: "transparent",
  borderTopWidth: 0,
  elevation: 0,
  shadowColor: "#000",
  shadowOpacity: 0.22,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 12 },
};

const tabBarItemStyle = {
  paddingVertical: 10,
};

const tabBarIconStyle = {
  marginTop: 0,
};

const sceneStyle = {
  backgroundColor: "#080D1A",
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.light.tint,
        tabBarInactiveTintColor: "#7C86AA",
        headerShown: false,
        tabBarShowLabel: false,
        sceneStyle,
        tabBarStyle,
        tabBarItemStyle,
        tabBarIconStyle,
        tabBarBackground: () => <TabBarGlass />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Tree",
          tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} Icon={Home} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: "Friends",
          tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} Icon={Users} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} Icon={User} />,
        }}
      />
    </Tabs>
  );
}
