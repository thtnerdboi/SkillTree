import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from "react-native-google-mobile-ads";

// TODO: Create rewarded ad units in your AdMob dashboard and replace these placeholder
// unit IDs. Keep the TestIds branches for __DEV__ so the emulator always uses test ads.
const REWARDED_UNIT_ID = Platform.select({
  android: __DEV__
    ? TestIds.REWARDED
    : "ca-app-pub-5851180331769845/REPLACE_ANDROID_REWARDED_UNIT",
  ios: __DEV__
    ? TestIds.REWARDED
    : "ca-app-pub-5851180331769845/REPLACE_IOS_REWARDED_UNIT",
})!;
import {
  Award,
  CheckCircle,
  ChevronRight,
  Crown,
  Edit2,
  LogOut,
  Shield,
  Star,
  Target,
  Trophy,
  Zap,
} from "lucide-react-native";

import Colors from "../../constants/colors";
import {
  DOMAIN_COLOR,
  SKILL_NODES,
  TREE_LEVELS,
  getNodesForLevel,
  getPrestigeBonusLabel,
  getPrestigeRank,
  getXpForCurrentLevel,
  getXpForNextLevel,
} from "../../mocks/mvp-data";
import { useAppState } from "../../state/app-state";
import { AdBanner } from "../../components/AdBanner";
import { ProUpgradeModal } from "../../components/ProUpgradeModal";
import { useRevenueCat } from "../../lib/revenuecat";

export default function ProfileScreen() {
  const {
    state,
    signOut,
    updateDisplayName,
    addBonusXp,
    userLevel,
    prestigeRank,
    weeklyCompletion,
    completedChallenges,
    completedNodes,
    completedLevels,
    isNodeComplete,
  } = useAppState();

  const [editingName, setEditingName] = useState<boolean>(false);
  const [nameInput, setNameInput] = useState<string>(state.displayName);
  const [adWatchCooldown, setAdWatchCooldown] = useState<boolean>(false);
  const [adLoaded, setAdLoaded] = useState<boolean>(false);
  const [proModalVisible, setProModalVisible] = useState<boolean>(false);
  const { openCustomerCenter, isCustomerCenterSupported } = useRevenueCat();

  // Rewarded ad — preloaded on mount so it's ready when the user taps.
  // Each RewardedAd instance can only be shown once; after dismiss we create a new one.
  const rewardedAdRef = useRef<RewardedAd | null>(null);
  const addBonusXpRef = useRef(addBonusXp);
  useEffect(() => { addBonusXpRef.current = addBonusXp; }, [addBonusXp]);

  useEffect(() => {
    let isMounted = true;

    const loadAd = () => {
      if (!isMounted) return;
      setAdLoaded(false);

      const ad = RewardedAd.createForAdRequest(REWARDED_UNIT_ID, {
        requestNonPersonalizedAdsOnly: true,
      });

      const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        if (!isMounted) return;
        rewardedAdRef.current = ad;
        setAdLoaded(true);
      });

      const unsubEarned = ad.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        () => {
          addBonusXpRef.current(100);
          setAdWatchCooldown(true);
          setTimeout(() => {
            if (isMounted) setAdWatchCooldown(false);
          }, 60_000);
        }
      );

      const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        unsubLoaded();
        unsubEarned();
        unsubClosed();
        unsubError();
        rewardedAdRef.current = null;
        setAdLoaded(false);
        loadAd(); // preload next one immediately
      });

      const unsubError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
        console.warn("[RewardedAd] Load error:", error.message);
        unsubLoaded();
        unsubEarned();
        unsubClosed();
        unsubError();
        rewardedAdRef.current = null;
        if (isMounted) setAdLoaded(false);
        setTimeout(loadAd, 30_000); // retry after 30 s
      });

      ad.load();
    };

    loadAd();

    return () => {
      isMounted = false;
      rewardedAdRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const xpCurrent = getXpForCurrentLevel(userLevel);
  const xpNext = getXpForNextLevel(userLevel);
  const xpProgress = xpNext > xpCurrent ? (state.xp - xpCurrent) / (xpNext - xpCurrent) : 1;
  const xpToNext = Math.max(0, xpNext - state.xp);

  const handleSaveName = () => {
    if (nameInput.trim()) {
      updateDisplayName(nameInput.trim());
    }
    setEditingName(false);
  };

  const handleWatchAd = () => {
    if (adWatchCooldown) return;
    if (!adLoaded || !rewardedAdRef.current) {
      Alert.alert("Ad Loading", "The ad is still loading. Please try again in a moment.");
      return;
    }
    rewardedAdRef.current.show().catch((error: Error) => {
      console.warn("[RewardedAd] Show error:", error.message);
      Alert.alert("Ad Unavailable", "Couldn't show the ad right now. Please try again later.");
    });
  };

  const avatarLetter = (state.displayName || "A").charAt(0).toUpperCase();
  const currentPrestigeBonus = getPrestigeBonusLabel(state.prestigeCount);
  const nextPrestige = getPrestigeRank(state.prestigeCount + 1);
  const nextPrestigeBonus = getPrestigeBonusLabel(state.prestigeCount + 1);

  const domainStats = (["body", "mind", "craft"] as const).map((d) => {
    const domNodes = SKILL_NODES.filter((n) => n.domainId === d);
    const doneNodes = domNodes.filter((n) => isNodeComplete(n.id)).length;
    return { domain: d, total: domNodes.length, done: doneNodes };
  });

  return (
    <View style={styles.shell}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.brand}>SKILLTREE</Text>
            <Text style={styles.pageTitle}>Profile</Text>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={[styles.avatar, { borderColor: `${prestigeRank.color}50` }]}>
                <Text style={styles.avatarLetter}>{avatarLetter}</Text>
                {state.prestigeCount > 0 && (
                  <View style={[styles.avatarPrestigeBadge, { backgroundColor: prestigeRank.color }]}>
                    <Text style={styles.avatarPrestigeNum}>{state.prestigeCount}</Text>
                  </View>
                )}
              </View>

              <View style={styles.heroInfo}>
                {editingName ? (
                  <View style={styles.nameEditRow}>
                    <TextInput
                      style={styles.nameInput}
                      value={nameInput}
                      onChangeText={setNameInput}
                      autoFocus
                      onBlur={handleSaveName}
                      onSubmitEditing={handleSaveName}
                      returnKeyType="done"
                      testID="edit-name-input"
                    />
                    <TouchableOpacity onPress={handleSaveName} testID="save-name">
                      <CheckCircle size={20} color={Colors.light.tint} strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Pressable
                    style={styles.nameRow}
                    onPress={() => {
                      setNameInput(state.displayName);
                      setEditingName(true);
                    }}
                    testID="edit-name"
                  >
                    <Text style={styles.heroName}>{state.displayName || "Adventurer"}</Text>
                    <Edit2 size={14} color={Colors.light.muted} strokeWidth={2.5} />
                  </Pressable>
                )}
                <View style={[styles.rankChip, { backgroundColor: `${prestigeRank.color}15`, borderColor: `${prestigeRank.color}40` }]}>
                  <Shield size={11} color={prestigeRank.color} strokeWidth={2.5} />
                  <Text style={[styles.rankChipText, { color: prestigeRank.color }]}>
                    {prestigeRank.name}
                  </Text>
                </View>
                <Text style={styles.inviteCode}>{state.inviteCode}</Text>
              </View>
            </View>

            <View style={styles.levelRow}>
              <View style={styles.levelInfo}>
                <Text style={styles.levelLabel}>LEVEL</Text>
                <Text style={styles.levelNum}>{userLevel}</Text>
              </View>
              <View style={styles.xpBarSection}>
                <View style={styles.xpBarTrack}>
                  <View style={[styles.xpBarFill, { width: `${Math.min(xpProgress * 100, 100)}%` as `${number}%` }]} />
                </View>
                <Text style={styles.xpBarLabel}>
                  {state.xp.toLocaleString()} XP{xpToNext > 0 ? ` · ${xpToNext} to Level ${userLevel + 1}` : " · Max Level"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>RANK BONUSES</Text>
            <View style={styles.prestigeBonusRow}>
              <View style={[styles.prestigeBonusOrb, { backgroundColor: `${prestigeRank.color}15`, borderColor: `${prestigeRank.color}35` }]}>
                <Shield size={18} color={prestigeRank.color} strokeWidth={2.5} />
              </View>
              <View style={styles.prestigeBonusInfo}>
                <Text style={styles.prestigeBonusLabel}>Current rank bonus</Text>
                <Text style={styles.prestigeBonusValue}>{prestigeRank.name} · {currentPrestigeBonus}</Text>
              </View>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Zap size={18} color={Colors.light.tint} strokeWidth={2.5} />
              <Text style={styles.statValue}>{state.xp.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Total XP</Text>
            </View>
            <View style={styles.statCard}>
              <Trophy size={18} color="#FFD700" strokeWidth={2.5} />
              <Text style={styles.statValue}>{state.prestigeCount}</Text>
              <Text style={styles.statLabel}>Prestiges</Text>
            </View>
            <View style={styles.statCard}>
              <Target size={18} color={Colors.light.success} strokeWidth={2.5} />
              <Text style={styles.statValue}>{completedNodes}</Text>
              <Text style={styles.statLabel}>Nodes Done</Text>
            </View>
            <View style={styles.statCard}>
              <CheckCircle size={18} color="#A78BFA" strokeWidth={2.5} />
              <Text style={styles.statValue}>{completedChallenges}</Text>
              <Text style={styles.statLabel}>Challenges</Text>
            </View>
            <View style={styles.statCard}>
              <Star size={18} color="#FF6A4D" strokeWidth={2.5} />
              <Text style={styles.statValue}>{completedLevels}</Text>
              <Text style={styles.statLabel}>Levels Done</Text>
            </View>
            <View style={styles.statCard}>
              <Award size={18} color={Colors.light.tint} strokeWidth={2.5} />
              <Text style={styles.statValue}>{weeklyCompletion}%</Text>
              <Text style={styles.statLabel}>Weekly</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>DOMAIN PROGRESS</Text>
            {domainStats.map(({ domain, total, done }) => {
              const pct = total > 0 ? done / total : 0;
              const color = DOMAIN_COLOR[domain];
              const label = domain.charAt(0).toUpperCase() + domain.slice(1);
              return (
                <View key={domain} style={styles.domainRow}>
                  <View style={[styles.domainDot, { backgroundColor: color }]} />
                  <Text style={styles.domainLabel}>{label}</Text>
                  <View style={styles.domainBarTrack}>
                    <View style={[styles.domainBarFill, { width: `${pct * 100}%` as `${number}%`, backgroundColor: color }]} />
                  </View>
                  <Text style={[styles.domainStat, { color }]}>{done}/{total}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>LEVEL PROGRESS</Text>
            {TREE_LEVELS.map((level) => {
              const nodes = getNodesForLevel(level.number);
              const doneNodes = nodes.filter((n) => isNodeComplete(n.id)).length;
              const levelComplete = doneNodes === nodes.length;
              const pct = nodes.length > 0 ? doneNodes / nodes.length : 0;

              return (
                <View key={level.number} style={styles.levelProgressRow}>
                  <View style={[styles.levelBadge, { backgroundColor: `${level.color}15`, borderColor: `${level.color}30` }]}>
                    <Text style={[styles.levelBadgeText, { color: level.color }]}>L{level.number}</Text>
                  </View>
                  <View style={styles.levelProgressInfo}>
                    <Text style={styles.levelProgressTitle}>{level.title}</Text>
                    <View style={styles.levelProgressBar}>
                      <View style={[styles.levelProgressFill, { width: `${pct * 100}%` as `${number}%`, backgroundColor: level.color }]} />
                    </View>
                  </View>
                  <Text style={[styles.levelProgressStat, levelComplete && { color: level.color }]}>
                    {doneNodes}/{nodes.length}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={[styles.sectionCard, { borderColor: `${nextPrestige.color}30` }]}>
              <Text style={styles.sectionTitle}>NEXT PRESTIGE</Text>
              <View style={styles.nextPrestigeRow}>
                <View style={[styles.nextPrestigeOrb, { backgroundColor: `${nextPrestige.color}15`, borderColor: `${nextPrestige.color}40` }]}>
                  <Trophy size={20} color={nextPrestige.color} strokeWidth={2.5} />
                </View>
                <View style={styles.nextPrestigeInfo}>
                  <Text style={[styles.nextPrestigeName, { color: nextPrestige.color }]}>{nextPrestige.name}</Text>
                  <Text style={styles.nextPrestigeHint}>Complete all 7 levels to unlock · {nextPrestigeBonus}</Text>
                </View>
              </View>
            </View>

          {!state.isPro && (
            <View style={styles.proCard}>
              <View style={styles.proCardTop}>
                <View style={styles.proCrownWrap}>
                  <Crown size={22} color="#FFD700" strokeWidth={2.5} />
                </View>
                <View style={styles.proCardInfo}>
                  <Text style={styles.proCardTitle}>SkillTree Pro</Text>
                  <Text style={styles.proCardSub}>1.5× XP · No ads · Priority AI</Text>
                </View>
                <View style={styles.proBadge}>
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
              </View>
              <View style={styles.proPerks}>
                {["1.5× XP on all challenges & rewards", "Ad-free experience", "Priority AI challenge generation"].map((perk) => (
                  <View key={perk} style={styles.proPerkRow}>
                    <CheckCircle size={13} color="#FFD700" strokeWidth={2.5} />
                    <Text style={styles.proPerkText}>{perk}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={styles.proUpgradeBtn}
                onPress={() => setProModalVisible(true)}
                testID="upgrade-pro"
              >
                <Crown size={15} color="#060810" strokeWidth={2.5} />
                <Text style={styles.proUpgradeBtnText}>Upgrade to Pro</Text>
              </TouchableOpacity>
            </View>
          )}

          {state.isPro && (
            <View style={styles.proActiveCard}>
              <Crown size={18} color="#FFD700" strokeWidth={2.5} />
              <View style={{ flex: 1 }}>
                <Text style={styles.proActiveTitle}>Pro Active</Text>
                <Text style={styles.proActiveSub}>Enjoying 1.5× XP & no ads</Text>
              </View>
              {isCustomerCenterSupported ? (
                <TouchableOpacity
                  style={styles.manageProBtn}
                  onPress={openCustomerCenter}
                  testID="manage-pro"
                >
                  <Text style={styles.manageProText}>Manage</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.proBadgeGold}>
                  <Text style={styles.proBadgeGoldText}>PRO</Text>
                </View>
              )}
            </View>
          )}

          {!state.isPro && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>BONUS XP</Text>
              <TouchableOpacity
                style={[
                  styles.adRewardBtn,
                  (adWatchCooldown || !adLoaded) && styles.adRewardBtnDisabled,
                ]}
                onPress={handleWatchAd}
                disabled={adWatchCooldown || !adLoaded}
                testID="watch-ad"
              >
                <View style={styles.adRewardLeft}>
                  <Zap
                    size={18}
                    color={adWatchCooldown || !adLoaded ? "#2A3560" : Colors.light.tint}
                    strokeWidth={2.5}
                  />
                  <View>
                    <Text
                      style={[
                        styles.adRewardTitle,
                        (adWatchCooldown || !adLoaded) && { color: "#2A3560" },
                      ]}
                    >
                      {adWatchCooldown
                        ? "Come back soon"
                        : !adLoaded
                        ? "Ad loading…"
                        : "Watch ad for +100 XP"}
                    </Text>
                    <Text style={styles.adRewardSub}>
                      {adWatchCooldown
                        ? "Reward claimed"
                        : !adLoaded
                        ? "Preparing your reward"
                        : "Rewarded ad · 30 seconds"}
                    </Text>
                  </View>
                </View>
                <ChevronRight
                  size={16}
                  color={adWatchCooldown || !adLoaded ? "#2A3560" : Colors.light.muted}
                  strokeWidth={2.5}
                />
              </TouchableOpacity>
            </View>
          )}

          {!state.isPro && <AdBanner style={{ marginBottom: 4 }} />}

          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={signOut}
            testID="sign-out"
          >
            <LogOut size={15} color="#FF6A4D" strokeWidth={2.5} />
            <Text style={styles.signOutText}>Sign Out & Reset</Text>
          </TouchableOpacity>

          <Text style={styles.footer}>SKILLTREE · v1.0</Text>
        </ScrollView>
      </SafeAreaView>
      <ProUpgradeModal
        visible={proModalVisible}
        onClose={() => setProModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#060810" },
  safeArea: { flex: 1 },
  scroll: { padding: 22, paddingBottom: 110, gap: 14 },

  header: { paddingBottom: 4 },
  brand: { fontFamily: "OutfitBlack", fontSize: 11, letterSpacing: 3.5, color: Colors.light.tint, textTransform: "uppercase" },
  pageTitle: { fontFamily: "OutfitBlack", fontSize: 30, color: Colors.light.text, marginTop: 4 },

  heroCard: { backgroundColor: "#0C1120", borderRadius: 24, padding: 20, gap: 20, borderWidth: 1, borderColor: "#1A2238" },
  heroTop: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: `${Colors.light.tint}15`, borderWidth: 2, alignItems: "center", justifyContent: "center", position: "relative" },
  avatarLetter: { fontFamily: "OutfitBlack", fontSize: 30, color: Colors.light.tint },
  avatarPrestigeBadge: { position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  avatarPrestigeNum: { fontFamily: "OutfitBlack", fontSize: 11, color: "#060810" },

  heroInfo: { flex: 1, gap: 6 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroName: { fontFamily: "OutfitBlack", fontSize: 22, color: Colors.light.text },
  nameEditRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameInput: { fontFamily: "OutfitBlack", flex: 1, fontSize: 22, color: Colors.light.text, backgroundColor: "#080B14", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.light.tint },
  rankChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, alignSelf: "flex-start" },
  rankChipText: { fontFamily: "OutfitBold", fontSize: 12 },
  inviteCode: { fontFamily: "OutfitSemiBold", fontSize: 11, color: "#2A3560", letterSpacing: 1 },

  levelRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  levelInfo: { alignItems: "center" },
  levelLabel: { fontFamily: "OutfitBold", fontSize: 9, letterSpacing: 2, color: Colors.light.muted, textTransform: "uppercase" },
  levelNum: { fontFamily: "OutfitBlack", fontSize: 32, color: Colors.light.text, lineHeight: 36 },
  xpBarSection: { flex: 1, gap: 6 },
  xpBarTrack: { height: 6, backgroundColor: "#111828", borderRadius: 3, overflow: "hidden" },
  xpBarFill: { height: "100%", backgroundColor: Colors.light.tint, borderRadius: 3 },
  xpBarLabel: { fontFamily: "OutfitSemiBold", fontSize: 11, color: Colors.light.muted },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { flex: 1, minWidth: "30%", backgroundColor: "#0C1120", borderRadius: 18, padding: 16, gap: 6, alignItems: "center", borderWidth: 1, borderColor: "#1A2238" },
  statValue: { fontFamily: "OutfitBlack", fontSize: 22, color: Colors.light.text },
  statLabel: { fontFamily: "OutfitSemiBold", fontSize: 10, color: Colors.light.muted, textAlign: "center" },

  sectionCard: { backgroundColor: "#0C1120", borderRadius: 22, padding: 20, gap: 14, borderWidth: 1, borderColor: "#1A2238" },
  sectionTitle: { fontFamily: "OutfitBold", fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", color: Colors.light.muted },

  domainRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  domainDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  domainLabel: { fontFamily: "OutfitBold", fontSize: 13, color: Colors.light.text, width: 44 },
  domainBarTrack: { flex: 1, height: 5, backgroundColor: "#111828", borderRadius: 3, overflow: "hidden" },
  domainBarFill: { height: "100%", borderRadius: 3 },
  domainStat: { fontFamily: "OutfitBold", fontSize: 12, width: 30, textAlign: "right" },

  levelProgressRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  levelBadge: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  levelBadgeText: { fontFamily: "OutfitBlack", fontSize: 12 },
  levelProgressInfo: { flex: 1, gap: 5 },
  levelProgressTitle: { fontFamily: "OutfitBold", fontSize: 13, color: Colors.light.text },
  levelProgressBar: { height: 4, backgroundColor: "#111828", borderRadius: 2, overflow: "hidden" },
  levelProgressFill: { height: "100%", borderRadius: 2 },
  levelProgressStat: { fontFamily: "OutfitBold", fontSize: 12, color: Colors.light.muted, width: 28, textAlign: "right" },

  prestigeBonusRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  prestigeBonusOrb: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  prestigeBonusInfo: { flex: 1, gap: 4 },
  prestigeBonusLabel: { fontFamily: "OutfitBold", fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase", color: Colors.light.muted },
  prestigeBonusValue: { fontFamily: "OutfitExtraBold", fontSize: 16, color: Colors.light.text },
  nextPrestigeRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  nextPrestigeOrb: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  nextPrestigeInfo: { flex: 1, gap: 4 },
  nextPrestigeName: { fontFamily: "OutfitBlack", fontSize: 18 },
  nextPrestigeHint: { fontFamily: "OutfitSemiBold", fontSize: 12, color: Colors.light.muted },

  adRewardBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#080B14", borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: `${Colors.light.tint}25` },
  adRewardBtnDisabled: { borderColor: "#1A2238" },
  adRewardLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  adRewardTitle: { fontFamily: "OutfitBold", fontSize: 14, color: Colors.light.text },
  adRewardSub: { fontFamily: "Outfit", fontSize: 11, color: Colors.light.muted, marginTop: 2 },

  signOutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FF6A4D10", borderRadius: 16, paddingVertical: 14, borderWidth: 1, borderColor: "#FF6A4D25" },
  signOutText: { fontFamily: "OutfitBold", fontSize: 14, color: "#FF6A4D" },

  footer: { fontFamily: "OutfitSemiBold", textAlign: "center", fontSize: 11, color: "#1A2238", letterSpacing: 1, paddingTop: 4 },

  proCard: { backgroundColor: "#0C1120", borderRadius: 22, padding: 20, gap: 16, borderWidth: 1.5, borderColor: "#FFD70040" },
  proCardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  proCrownWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFD70015", borderWidth: 1.5, borderColor: "#FFD70040", alignItems: "center", justifyContent: "center" },
  proCardInfo: { flex: 1 },
  proCardTitle: { fontFamily: "OutfitBlack", fontSize: 17, color: Colors.light.text },
  proCardSub: { fontFamily: "OutfitSemiBold", fontSize: 12, color: Colors.light.muted, marginTop: 2 },
  proBadge: { backgroundColor: "#FFD700", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },
  proBadgeText: { fontFamily: "OutfitBlack", fontSize: 10, color: "#060810", letterSpacing: 1 },
  proPerks: { gap: 9 },
  proPerkRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  proPerkText: { fontFamily: "OutfitSemiBold", fontSize: 13, color: Colors.light.muted, flex: 1 },
  proUpgradeBtn: { backgroundColor: "#FFD700", borderRadius: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: "#FFD700", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  proUpgradeBtnText: { fontFamily: "OutfitBlack", fontSize: 15, color: "#060810", letterSpacing: 0.3 },

  proActiveCard: { backgroundColor: "#FFD70008", borderRadius: 18, paddingVertical: 14, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#FFD70030" },
  proActiveTitle: { fontFamily: "OutfitExtraBold", fontSize: 14, color: Colors.light.text },
  proActiveSub: { fontFamily: "OutfitSemiBold", fontSize: 12, color: Colors.light.muted, marginTop: 1 },
  proBadgeGold: { backgroundColor: "#FFD700", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },
  proBadgeGoldText: { fontFamily: "OutfitBlack", fontSize: 10, color: "#060810", letterSpacing: 1 },
  manageProBtn: { backgroundColor: "#FFD700", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  manageProText: { fontFamily: "OutfitBlack", fontSize: 11, color: "#060810", letterSpacing: 0.5 },
});
