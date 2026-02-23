import React, { useMemo } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Trophy, Medal } from "lucide-react-native";

import Colors from "../../constants/colors";
import { trpc } from "../../lib/trpc";
import { useAppState } from "../../state/app-state";

const MEDAL_COLORS = ["#FFD700", "#C0C8D8", "#CD7F32"];

export default function LeaderboardScreen() {
  const { state, weeklyCompletion } = useAppState();
  const isReady = Boolean(state.userId && state.displayName && state.inviteCode);

  const circleQuery = trpc.social.getCircleStats.useQuery(
    { userId: state.userId },
    { enabled: isReady, refetchInterval: 10000 }
  );

  const leaderboard = useMemo(() => {
    const entries = circleQuery.data ?? [];
    return [...entries].sort((a, b) => b.weeklyCompletion - a.weeklyCompletion);
  }, [circleQuery.data]);

  const selfRank = leaderboard.findIndex((e) => e.userId === state.userId) + 1;

  return (
    <View style={styles.shell}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.brand}>SKILLTREE</Text>
            <Text style={styles.title}>Leaderboard</Text>
          </View>

          <View style={styles.selfCard}>
            <View style={styles.selfTop}>
              <View>
                <Text style={styles.selfName}>
                  {state.displayName || "You"}
                </Text>
                <Text style={styles.selfCode}>{state.inviteCode}</Text>
              </View>
              <View style={styles.selfStatGroup}>
                <Text style={styles.selfPct}>{weeklyCompletion}%</Text>
                <Text style={styles.selfStatLabel}>this week</Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(weeklyCompletion, 100)}%` as `${number}%` },
                ]}
              />
            </View>
            {selfRank > 0 && (
              <Text style={styles.selfRank}>
                Rank #{selfRank} in your circle
              </Text>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Trophy size={14} color={Colors.light.tint} strokeWidth={2} />
              <Text style={styles.cardLabel}>RANKINGS</Text>
            </View>

            {circleQuery.isLoading ? (
              <Text style={styles.emptyText}>Loading rankings...</Text>
            ) : leaderboard.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  Add friends to start competing.
                </Text>
              </View>
            ) : (
              leaderboard.map((entry, index) => {
                const isSelf = entry.userId === state.userId;
                const medalColor = MEDAL_COLORS[index] ?? null;
                const barWidth = Math.min(entry.weeklyCompletion, 100);

                return (
                  <View
                    key={entry.userId}
                    style={[
                      styles.rankRow,
                      isSelf && styles.rankRowSelf,
                    ]}
                  >
                    <View style={styles.rankLeft}>
                      {medalColor && index < 3 ? (
                        <Medal
                          size={18}
                          color={medalColor}
                          strokeWidth={2}
                        />
                      ) : (
                        <Text style={styles.rankNum}>{index + 1}</Text>
                      )}
                    </View>

                    <View style={styles.rankAvatar}>
                      <Text style={styles.rankAvatarText}>
                        {entry.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.rankInfo}>
                      <View style={styles.rankNameRow}>
                        <Text style={[styles.rankName, isSelf && styles.rankNameSelf]}>
                          {isSelf ? "You" : entry.name}
                        </Text>
                        <Text style={[styles.rankPct, isSelf && styles.rankPctSelf]}>
                          {entry.weeklyCompletion}%
                        </Text>
                      </View>
                      <View style={styles.rankBarTrack}>
                        <View
                          style={[
                            styles.rankBarFill,
                            {
                              width: `${barWidth}%` as `${number}%`,
                              backgroundColor: isSelf
                                ? Colors.light.tint
                                : "#3A4060",
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: "#060810",
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    padding: 22,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    paddingBottom: 4,
  },
  brand: {
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.light.tint,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.light.text,
    marginTop: 4,
  },
  selfCard: {
    backgroundColor: "#0C1628",
    borderRadius: 22,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: `${Colors.light.tint}30`,
    shadowColor: Colors.light.tint,
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  selfTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selfName: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.light.text,
  },
  selfCode: {
    fontSize: 11,
    color: "#2A3560",
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  selfStatGroup: {
    alignItems: "flex-end",
  },
  selfPct: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.light.tint,
    lineHeight: 36,
  },
  selfStatLabel: {
    fontSize: 11,
    color: "#3A4870",
    fontWeight: "600",
  },
  progressTrack: {
    height: 5,
    backgroundColor: "#111828",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.light.tint,
    borderRadius: 3,
  },
  selfRank: {
    fontSize: 12,
    color: "#3A4870",
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#0C1120",
    borderRadius: 22,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: "#1A2238",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  cardLabel: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: Colors.light.muted,
    fontWeight: "700",
  },
  emptyState: {
    paddingVertical: 16,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
    color: "#2A3560",
    textAlign: "center",
    fontWeight: "500",
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#080B14",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#141C2E",
  },
  rankRowSelf: {
    borderColor: `${Colors.light.tint}30`,
    backgroundColor: "#0A1020",
  },
  rankLeft: {
    width: 22,
    alignItems: "center",
  },
  rankNum: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3A4060",
  },
  rankAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#111828",
    borderWidth: 1,
    borderColor: "#1A2238",
    alignItems: "center",
    justifyContent: "center",
  },
  rankAvatarText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.light.muted,
  },
  rankInfo: {
    flex: 1,
    gap: 6,
  },
  rankNameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rankName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
  },
  rankNameSelf: {
    color: Colors.light.tint,
    fontWeight: "800",
  },
  rankPct: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.muted,
  },
  rankPctSelf: {
    color: Colors.light.tint,
  },
  rankBarTrack: {
    height: 3,
    backgroundColor: "#111828",
    borderRadius: 2,
    overflow: "hidden",
  },
  rankBarFill: {
    height: "100%",
    borderRadius: 2,
  },
});
