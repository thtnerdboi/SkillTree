import React from 'react';
import { Tabs } from 'expo-router';
// Notice Trophy is imported here with the other icons!
import { TreePine, Users, User, Trophy } from 'lucide-react-native'; 
import Colors from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.light.tint,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        tabBarStyle: {
          backgroundColor: '#0C1120',
          borderTopColor: '#1A2238',
          height: 60 + insets.bottom, 
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
      
      {/* 👇 Drop the Leaderboard right here 👇 */}
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Rankings',
          tabBarIcon: ({ color }) => <Trophy size={24} color={color} />,
        }}
      />
      {/* 👆 ================================ 👆 */}

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