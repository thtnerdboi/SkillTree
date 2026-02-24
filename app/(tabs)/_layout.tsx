import React from 'react';
import { Tabs } from 'expo-router';
import { TreePine, Users, User } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // 1. Import this

export default function TabLayout() {
  const insets = useSafeAreaInsets(); // 2. Get the phone's safe zone numbers

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.light.tint,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        tabBarStyle: {
          backgroundColor: '#0C1120',
          borderTopColor: '#1A2238',
          // 3. Dynamic height: base height + the bottom bar size
          height: 60 + insets.bottom, 
          // 4. Dynamic padding: push icons up exactly enough
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8, 
          display: 'flex',
        },
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tree',
          tabBarIcon: ({ color }) => <TreePine size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color }) => <Users size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}