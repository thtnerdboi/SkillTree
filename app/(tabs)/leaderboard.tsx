import React, { useMemo } from "react";
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Crown, Medal, Trophy } from "lucide-react-native";

import Colors from "@/constants/colors";

const MOCK_USERS = [
  { id: "usr_1", name: "Nova Quinn", xp: 12840 },
  { id: "usr_2", name: "Ari Stone", xp: 12110 },
  { id: "usr_3", name: "Kai Mercer", xp: 11490 },
  { id: "usr_4", name: "Jules Park", xp: 10320 },
  { id: "usr_5", name: "Remy Cross", xp: 9880 },
  { id: "usr_6", name: "Sage Monroe", xp: 9340 },
  { id: "usr_7", name: "Milan Frost", xp: 8750 },
  { id: "usr_8", name: "Rory Vale", xp: 8210 },
];

const TOP_THREE_STYLES = {
  1: { accent: "#E8C76D", border: "#5A4721", bg: "#191406" },
  2: { accent: "#B7C0D8", border: "#3B445A", bg: "#10131C" },
  3: { accent: "#D3986F", border: "#5B3A26", bg: "#1A100C" },
} as const;

type RankedUser = {
  id: string;
  name: string;
  xp: number;
  rank: number;
};

export default function LeaderboardScreen() {
  const rankedUsers = useMemo<RankedUser[]>(() => {
    return [...MOCK_USERS]
      .sort((a, b) => b.xp - a.xp)
      .map((user, index) => ({ ...user, rank: index + 1 }));
  }, []);

  const renderItem = ({ item }: { item: RankedUser }) => {
    const topStyle = TOP_THREE_STYLES[item.rank as keyof typeof TOP_THREE_STYLES];
    const isTopThree = item.rank <= 3;

    return (
      <View
        style={[
          styles.row,
          isTopThree && {
            borderColor: topStyle.border,
            backgroundColor: topStyle.bg,
            shadowColor: topStyle.accent,
          },
        ]}
      >
        <View style={[styles.rankPill, isTopThree && { borderColor: topStyle.border }]}> 
          {item.rank === 1 ? (
            <Crown size={14} color={topStyle.accent} />
          ) : item.rank <= 3 ? (
            <Medal size={14} color={topStyle.accent} />
          ) : (
            <Text style={styles.rankText}>#{item.rank}</Text>
          )}
        </View>

        <View style={styles.nameBlock}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={[styles.subtitle, isTopThree && { color: topStyle.accent }]}>Elite Challenger</Text>
        </View>

        <View style={styles.xpBlock}>
          <Text style={[styles.xpValue, isTopThree && { color: topStyle.accent }]}>{item.xp.toLocaleString()}</Text>
          <Text style={styles.xpLabel}>XP</Text>
        </View>
      </View>
    );
  };

  const topUser = rankedUsers[0];

  return (
    <View style={styles.shell}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.brand}>SKILLTREE</Text>
          <Text style={styles.title}>Leaderboard</Text>
          <View style={styles.heroCard}>
            <View style={styles.heroTitleRow}>
              <Trophy size={16} color="#E8C76D" />
              <Text style={styles.heroLabel}>Top Performer</Text>
            </View>
            <Text style={styles.heroName}>{topUser.name}</Text>
            <Text style={styles.heroXp}>{topUser.xp.toLocaleString()} XP</Text>
          </View>
        </View>

        <FlatList
          data={rankedUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 14,
    gap: 8,
  },
  brand: {
    color: Colors.light.tint,
    letterSpacing: 3,
    textTransform: "uppercase",
    fontSize: 11,
    fontFamily: "monospace",
  },
  title: {
    color: "#F4F7FF",
    fontSize: 32,
    fontFamily: "OutfitBlack",
  },
  heroCard: {
    marginTop: 6,
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.light.arcadeBlue,
    padding: 16,
    gap: 4,
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroLabel: {
    color: "#A3AFCC",
    fontSize: 12,
    fontFamily: "OutfitSemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroName: {
    color: "#FFFFFF",
    fontSize: 20,
    fontFamily: "OutfitExtraBold",
  },
  heroXp: {
    color: "#E8C76D",
    fontSize: 16,
    fontFamily: "OutfitBold",
  },
  listContent: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 30,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderWidth: 2,
    borderColor: Colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  rankPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#253154",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.surfaceDeep,
  },
  rankText: {
    color: "#90A0C8",
    fontSize: 12,
    fontFamily: "OutfitBold",
  },
  nameBlock: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    color: "#F5F8FF",
    fontSize: 17,
    fontFamily: "OutfitSemiBold",
  },
  subtitle: {
    color: "#6F7EA7",
    fontSize: 12,
    fontFamily: "Outfit",
    marginTop: 2,
  },
  xpBlock: {
    alignItems: "flex-end",
    marginLeft: 8,
  },
  xpValue: {
    color: "#B7C5F0",
    fontSize: 17,
    fontFamily: "OutfitExtraBold",
  },
  xpLabel: {
    color: "#5A6891",
    fontSize: 11,
    fontFamily: "OutfitBold",
    letterSpacing: 0.8,
  },
});
