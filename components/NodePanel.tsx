import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Check, Lock, X, Zap, Sparkles, Activity, Clock, Pin, Timer } from "lucide-react-native";
import { trpc } from "@/lib/trpc";
import Colors from "@/constants/colors";
import { DOMAIN_COLOR, DOMAIN_LABEL, SKILL_NODES } from "@/mocks/mvp-data";
import { useAppState } from "@/state/app-state";
import { FocusSessionModal } from "@/components/FocusSessionModal";
import {
  isFitnessChallengeVerified,
  getFitnessMetricLabel,
  formatFitnessValue,
  type FitnessLogEntry,
} from "@/utils/fitness-verify";
import { todayKey } from "@/utils/streak-helpers";

type IconComponent = React.ComponentType<{ size: number; color: string; strokeWidth: number }>;

type Props = {
  node: (typeof SKILL_NODES)[0];
  onClose: () => void;
  iconMap: Record<string, IconComponent>;
  flashXP: (amount: number) => void;
  onNodeComplete?: (nodeId: string) => void;
};

function alpha(hexColor: string, value: string): string {
  return `${hexColor}${value}`;
}

export function NodePanel({ node, onClose, iconMap, flashXP, onNodeComplete }: Props) {
  const { state, toggleChallenge, isNodeComplete, isNodeUnlocked, setAiChallenges, recordAiGeneration, logFitness, recordFocusSession } = useAppState();
  const [goalInput, setGoalInput] = useState<string>("");
  const [justCompleted, setJustCompleted] = useState(false);
  const [focusChallenge, setFocusChallenge] = useState<typeof node.defaultChallenges[0] | null>(null);
  const [showFitnessForm, setShowFitnessForm] = useState<string | null>(null);
  const [fitnessSteps, setFitnessSteps] = useState<string>("");
  const [fitnessMinutes, setFitnessMinutes] = useState<string>("");
  const [fitnessDistance, setFitnessDistance] = useState<string>("");

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslate = useRef(new Animated.Value(40)).current;
  const cardScale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(cardTranslate, {
        toValue: 0,
        useNativeDriver: true,
        tension: 52,
        friction: 11,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 54,
        friction: 10,
      }),
    ]).start();
  }, [cardScale, cardTranslate, overlayOpacity]);

  const close = useCallback(() => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslate, {
        toValue: 36,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(cardScale, {
        toValue: 0.98,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (justCompleted) {
        onNodeComplete?.(node.id);
      }
      setJustCompleted(false);
      onClose();
    });
  }, [cardScale, cardTranslate, node.id, onClose, onNodeComplete, overlayOpacity, justCompleted]);

  const regenerateNodeMutation = trpc.ai.regenerateNode.useMutation({
    onSuccess: (challenges) => {
      const fixed = node.defaultChallenges.filter((c) => c.isFixed);
      const replaceableCount = node.defaultChallenges.length - fixed.length;
      const aiGenerated = challenges.slice(0, replaceableCount).map((c, i) => ({
        id: `ai-${node.id}-${i}-${Date.now()}`,
        nodeId: node.id,
        title: c.title,
        detail: c.detail,
        xp: c.xp,
        type: "manual" as const,
      }));
      // Fixed challenges are always preserved and prepended — AI cannot replace them
      setAiChallenges(node.id, [...fixed, ...aiGenerated]);
      setGoalInput("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e) => {
      console.error("[panel] AI generation failed:", e);
      Alert.alert("Generation Failed", "Please check your connection and try again.");
    },
  });

  const handleRegenerate = () => {
    const COOLDOWN_MS = 24 * 60 * 60 * 1000;
    const lastGen = state.lastAiGenTime?.[node.domainId] || 0;
    const timeSinceLastGen = Date.now() - lastGen;
    const isCooldownActive = timeSinceLastGen < COOLDOWN_MS;

    if (!state.isPro && isCooldownActive) {
      const hoursLeft = Math.ceil((COOLDOWN_MS - timeSinceLastGen) / (1000 * 60 * 60));
      Alert.alert(
        "⏱️ AI Recharging",
        `You've already personalized ${node.domainId.toUpperCase()} today. Wait ${hoursLeft}h or upgrade to Pro for unlimited use.`,
        [{ text: "Later", style: "cancel" }, { text: "Unlock Pro", onPress: () => console.log("Show Pro Modal") }]
      );
      return;
    }

    if (goalInput.trim().length > 8 && !regenerateNodeMutation.isPending) {
      recordAiGeneration(node.domainId);
      const xpValues = node.defaultChallenges.map((c) => c.xp) as [number, number, number];
      regenerateNodeMutation.mutate({
        nodeId: node.id,
        nodeTitle: node.title,
        nodeDescription: node.description,
        goal: goalInput.trim(),
        xpValues,
      });
    }
  };

  const nodeColor = DOMAIN_COLOR[node.domainId];
  const nodeUnlocked = isNodeUnlocked(node.id);
  const nodeComplete = isNodeComplete(node.id);

  useEffect(() => {
    if (!nodeComplete && justCompleted) {
      setJustCompleted(false);
    }
  }, [nodeComplete, justCompleted]);
  const hasAiChallenges = (state.aiChallenges[node.id] ?? []).length > 0;
  const activeChallenges = useMemo(() => {
    const customChallenges = state.aiChallenges[node.id] ?? [];
    return customChallenges.length > 0 ? customChallenges : node.defaultChallenges;
  }, [node.defaultChallenges, node.id, state.aiChallenges]);
  
  const nodeProgress = activeChallenges.filter((challenge) => state.challengeProgress[challenge.id]).length;
  const completionRatio = activeChallenges.length > 0 ? nodeProgress / activeChallenges.length : 0;
  const NodeIcon = iconMap[node.icon];

  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <Pressable style={styles.backdrop} onPress={close} testID="close-panel-backdrop" />
        
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
          <Animated.View
            style={[
              styles.modalCard,
              {
                transform: [{ translateY: cardTranslate }, { scale: cardScale }],
              },
            ]}
          >
            <BlurView tint="dark" intensity={80} style={styles.blurShell}>
              <ScrollView
                style={styles.contentScroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <LinearGradient
                  colors={[alpha(nodeColor, "50"), alpha(nodeColor, "18"), "rgba(6,8,16,0.96)"]}
                  start={{ x: 0.15, y: 0 }}
                  end={{ x: 0.85, y: 1 }}
                  style={styles.hero}
                >
                  <View style={styles.heroTopBar}>
                    <View style={[styles.domainChip, { borderColor: alpha(nodeColor, "45"), backgroundColor: alpha(nodeColor, "20") }]}>
                      <Text style={[styles.domainChipText, { color: nodeColor }]}>{DOMAIN_LABEL[node.domainId]}</Text>
                    </View>
                    <Pressable style={styles.closeButton} onPress={close} testID="close-panel">
                      <BlurView tint="dark" intensity={60} style={styles.closeButtonBlur}>
                        <X size={16} color={Colors.light.text} strokeWidth={2.4} />
                      </BlurView>
                    </Pressable>
                  </View>

                  <View style={styles.heroCenter}>
                    <View style={[styles.heroGlowOuter, { backgroundColor: alpha(nodeColor, "18") }]} />
                    <View style={[styles.heroGlowMid, { backgroundColor: alpha(nodeColor, "22") }]} />
                    <View
                      style={[
                        styles.heroIconShell,
                        {
                          borderColor: alpha(nodeColor, "4A"),
                          backgroundColor: alpha(nodeColor, "12"),
                        },
                      ]}
                    >
                      {NodeIcon ? (
                        <NodeIcon size={72} color={nodeColor} strokeWidth={2.1} />
                      ) : (
                        <Zap size={72} color={nodeColor} strokeWidth={2.1} />
                      )}
                    </View>
                  </View>

                  <View style={styles.heroTextWrap}>
                    <Text style={styles.title}>{node.title}</Text>
                    <Text style={styles.description}>{node.description}</Text>
                    <View style={styles.metaRow}>
                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Progress</Text>
                        <Text style={[styles.metaValue, { color: nodeColor }]}>
                          {nodeProgress}/{activeChallenges.length}
                        </Text>
                      </View>
                      <View style={styles.metaDivider} />
                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Status</Text>
                        <Text style={[styles.metaValue, { color: nodeComplete ? nodeColor : Colors.light.text }]}>
                          {nodeComplete ? "Completed" : nodeUnlocked ? "Active" : "Locked"}
                        </Text>
                      </View>
                      <View style={styles.metaDivider} />
                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Domain</Text>
                        <Text style={styles.metaValue}>{DOMAIN_LABEL[node.domainId]}</Text>
                      </View>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.max(8, completionRatio * 100)}%` as `${number}%`, backgroundColor: nodeColor }]} />
                    </View>
                  </View>
                </LinearGradient>

                <View style={styles.contentContainer}>
                  {nodeComplete ? (
                    <View style={[styles.bannerCard, { borderColor: alpha(nodeColor, "38") }]}>
                      <BlurView tint="dark" intensity={55} style={styles.bannerBlur}>
                        <Check size={16} color={nodeColor} strokeWidth={2.8} />
                        <Text style={[styles.bannerText, { color: nodeColor }]}>Node mastered. Bonus XP secured.</Text>
                      </BlurView>
                    </View>
                  ) : null}

                  {nodeUnlocked && (
                    <View style={[styles.regenSection, { borderColor: alpha(nodeColor, "25") }]}>
                      <BlurView tint="dark" intensity={40} style={styles.regenBlur}>
                        <View style={styles.regenLabelRow}>
                          <Sparkles size={12} color={nodeColor} strokeWidth={2.5} />
                          <Text style={styles.regenLabel}>PERSONALIZE CHALLENGES</Text>
                        </View>
                        <TextInput
                          style={[styles.regenInput, { borderColor: goalInput.length > 0 ? alpha(nodeColor, "50") : "rgba(255,255,255,0.08)" }]}
                          value={goalInput}
                          onChangeText={setGoalInput}
                          placeholder={node.goalPrompt}
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          multiline
                          numberOfLines={2}
                        />
                        <TouchableOpacity
                          style={[
                            styles.regenBtn,
                            goalInput.trim().length > 8 && !regenerateNodeMutation.isPending
                              ? { backgroundColor: nodeColor }
                              : { backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
                          ]}
                          onPress={handleRegenerate}
                          disabled={goalInput.trim().length <= 8 || regenerateNodeMutation.isPending}
                        >
                          {regenerateNodeMutation.isPending ? (
                            <ActivityIndicator size="small" color={nodeColor} />
                          ) : (
                            <>
                              <Sparkles size={14} color={goalInput.trim().length > 8 ? "#000" : "rgba(255,255,255,0.4)"} strokeWidth={2.5} />
                              <Text style={[styles.regenBtnText, { color: goalInput.trim().length > 8 ? "#000" : "rgba(255,255,255,0.4)" }]}>
                                {hasAiChallenges ? "Regenerate Goals" : "Generate Custom Goals"}
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </BlurView>
                    </View>
                  )}

                  {activeChallenges.map((challenge) => {
                    const done = state.challengeProgress[challenge.id] ?? false;
                    const challengeType = challenge.type ?? "manual";
                    const isFixed = challenge.isFixed === true;
                    const todayFitnessLog = state.fitnessLogs[todayKey()];
                    const fitnessVerified = challengeType === "fitness"
                      ? isFitnessChallengeVerified(challenge, todayFitnessLog)
                      : false;
                    const focusCompleted = challengeType === "focus"
                      ? state.focusSessionsCompleted[challenge.id] !== undefined
                      : false;
                    const isVerified = fitnessVerified || focusCompleted;

                    const handleChallengePress = async () => {
                      if (!nodeUnlocked) return;

                      if (challengeType === "focus" && !done) {
                        setFocusChallenge(challenge);
                        await Haptics.selectionAsync();
                        return;
                      }

                      if (challengeType === "fitness" && !done) {
                        setShowFitnessForm(showFitnessForm === challenge.id ? null : challenge.id);
                        await Haptics.selectionAsync();
                        return;
                      }

                      toggleChallenge(challenge.id, node.id, challenge.xp);
                      if (!done) {
                        flashXP(challenge.xp);
                        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        if (nodeProgress + 1 === activeChallenges.length) {
                          setJustCompleted(true);
                        }
                      } else {
                        await Haptics.selectionAsync();
                      }
                    };

                    return (
                      <View key={challenge.id}>
                        <Pressable
                          onPress={handleChallengePress}
                          testID={`challenge-${challenge.id}`}
                          style={({ pressed }) => [styles.challengeCardWrap, pressed && styles.challengeCardPressed]}
                        >
                          <BlurView tint="dark" intensity={60} style={[styles.challengeCard, !nodeUnlocked && styles.challengeLocked]}>
                            <View style={styles.challengeLeft}>
                              <View
                                style={[
                                  styles.checkOrb,
                                  {
                                    borderColor: done ? nodeColor : alpha(nodeColor, "40"),
                                    backgroundColor: done ? nodeColor : alpha(nodeColor, "14"),
                                  },
                                ]}
                              >
                                {done ? (
                                  <Check size={12} color="#02050C" strokeWidth={3} />
                                ) : !nodeUnlocked ? (
                                  <Lock size={12} color={Colors.light.muted} strokeWidth={2.4} />
                                ) : null}
                              </View>
                              <View style={styles.challengeTextBlock}>
                                <View style={styles.challengeTitleRow}>
                                  <Text style={[styles.challengeTitle, done && styles.challengeTitleDone]}>{challenge.title}</Text>
                                  {isFixed ? (
                                    <View style={styles.fixedBadge}>
                                      <Pin size={8} color={nodeColor} strokeWidth={2.5} />
                                      <Text style={[styles.fixedBadgeText, { color: nodeColor }]}>FIXED</Text>
                                    </View>
                                  ) : null}
                                  {isVerified && !done ? (
                                    <View style={[styles.verifiedBadge, { borderColor: alpha(nodeColor, "40"), backgroundColor: alpha(nodeColor, "14") }]}>
                                      <Check size={8} color={nodeColor} strokeWidth={3} />
                                      <Text style={[styles.verifiedBadgeText, { color: nodeColor }]}>VERIFIED</Text>
                                    </View>
                                  ) : null}
                                </View>
                                <Text style={styles.challengeDetail}>{challenge.detail}</Text>
                                {challengeType === "focus" && challenge.focusDuration ? (
                                  <View style={styles.typeTagRow}>
                                    <Clock size={10} color={nodeColor} strokeWidth={2.2} />
                                    <Text style={[styles.typeTagText, { color: nodeColor }]}>{challenge.focusDuration} min focus session</Text>
                                  </View>
                                ) : null}
                                {challengeType === "fitness" && challenge.fitnessMetric && challenge.fitnessThreshold ? (
                                  <View style={styles.typeTagRow}>
                                    <Activity size={10} color={nodeColor} strokeWidth={2.2} />
                                    <Text style={[styles.typeTagText, { color: nodeColor }]}>
                                      {getFitnessMetricLabel(challenge.fitnessMetric)}: {formatFitnessValue(challenge.fitnessMetric, challenge.fitnessThreshold)}
                                      {fitnessVerified ? " ✓" : ""}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                            </View>

                            <View style={styles.challengeRight}>
                              {challengeType === "focus" && !done ? (
                                <View style={[styles.actionPill, { borderColor: alpha(nodeColor, "40"), backgroundColor: alpha(nodeColor, "18") }]}>
                                  <Timer size={10} color={nodeColor} strokeWidth={2.5} />
                                  <Text style={[styles.actionPillText, { color: nodeColor }]}>Start</Text>
                                </View>
                              ) : challengeType === "fitness" && !done ? (
                                <View style={[styles.actionPill, { borderColor: alpha(nodeColor, "40"), backgroundColor: alpha(nodeColor, "18") }]}>
                                  <Activity size={10} color={nodeColor} strokeWidth={2.5} />
                                  <Text style={[styles.actionPillText, { color: nodeColor }]}>Log</Text>
                                </View>
                              ) : (
                                <View style={[styles.xpPill, { borderColor: alpha(nodeColor, "30"), backgroundColor: alpha(nodeColor, "14") }]}>
                                  <Zap size={10} color={nodeColor} strokeWidth={2.5} />
                                  <Text style={[styles.xpPillText, { color: nodeColor }]}>+{challenge.xp}</Text>
                                </View>
                              )}
                            </View>
                          </BlurView>
                        </Pressable>

                        {showFitnessForm === challenge.id && challengeType === "fitness" && !done ? (
                          <View style={[styles.fitnessForm, { borderColor: alpha(nodeColor, "24") }]}>
                            <Text style={styles.fitnessFormLabel}>LOG TODAY&apos;S ACTIVITY</Text>
                            <Text style={styles.fitnessFormHint}>
                              Enter your {getFitnessMetricLabel(challenge.fitnessMetric ?? "steps").toLowerCase()} from your phone or watch health app.
                            </Text>
                            {challenge.fitnessMetric === "steps" ? (
                              <TextInput
                                style={styles.fitnessInput}
                                value={fitnessSteps}
                                onChangeText={setFitnessSteps}
                                placeholder="e.g. 5200"
                                placeholderTextColor="#4A5680"
                                keyboardType="numeric"
                              />
                            ) : null}
                            {challenge.fitnessMetric === "activeMinutes" ? (
                              <TextInput
                                style={styles.fitnessInput}
                                value={fitnessMinutes}
                                onChangeText={setFitnessMinutes}
                                placeholder="e.g. 22"
                                placeholderTextColor="#4A5680"
                                keyboardType="numeric"
                              />
                            ) : null}
                            {challenge.fitnessMetric === "distance" ? (
                              <TextInput
                                style={styles.fitnessInput}
                                value={fitnessDistance}
                                onChangeText={setFitnessDistance}
                                placeholder="e.g. 3.5"
                                placeholderTextColor="#4A5680"
                                keyboardType="decimal-pad"
                              />
                            ) : null}
                            <Pressable
                              onPress={async () => {
                                const steps = parseInt(fitnessSteps, 10) || 0;
                                const minutes = parseInt(fitnessMinutes, 10) || 0;
                                const distance = parseFloat(fitnessDistance) || 0;
                                const entry: FitnessLogEntry = {
                                  steps,
                                  activeMinutes: minutes,
                                  distance,
                                  loggedAt: new Date().toISOString(),
                                };
                                logFitness(entry);
                                setShowFitnessForm(null);
                                setFitnessSteps("");
                                setFitnessMinutes("");
                                setFitnessDistance("");
                                const verified = isFitnessChallengeVerified(challenge, entry);
                                if (verified) {
                                  toggleChallenge(challenge.id, node.id, challenge.xp);
                                  flashXP(challenge.xp);
                                  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                  if (nodeProgress + 1 === activeChallenges.length) {
                                    setJustCompleted(true);
                                  }
                                } else {
                                  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                                }
                              }}
                              style={({ pressed }) => [
                                styles.fitnessSubmitBtn,
                                { backgroundColor: alpha(nodeColor, "20"), borderColor: alpha(nodeColor, "34") },
                                pressed && { opacity: 0.85 },
                              ]}
                            >
                              <Text style={[styles.fitnessSubmitText, { color: nodeColor }]}>Verify & Complete</Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
                <View style={styles.footerSpace} />
              </ScrollView>
            </BlurView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>

      {focusChallenge ? (
        <FocusSessionModal
          visible={focusChallenge !== null}
          durationMinutes={focusChallenge.focusDuration ?? 30}
          challengeTitle={focusChallenge.title}
          challengeId={focusChallenge.id}
          nodeColor={nodeColor}
          onClose={() => setFocusChallenge(null)}
          onComplete={() => {
            if (focusChallenge) {
              recordFocusSession(focusChallenge.id);
              toggleChallenge(focusChallenge.id, node.id, focusChallenge.xp);
              flashXP(focusChallenge.xp);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              if (nodeProgress + 1 === activeChallenges.length) {
                setJustCompleted(true);
              }
            }
            setFocusChallenge(null);
          }}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(3,6,12,0.55)",
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    flex: 1,
    marginTop: Platform.OS === "web" ? 24 : 12,
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 34,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.34,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 24,
  },
  blurShell: {
    flex: 1,
    backgroundColor: "rgba(8,10,18,0.55)",
  },
  hero: {
    paddingTop: 24,
    paddingHorizontal: 22,
    paddingBottom: 22,
    justifyContent: "space-between",
  },
  heroTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  domainChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  domainChipText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  closeButton: {
    borderRadius: 999,
    overflow: "hidden",
  },
  closeButtonBlur: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  heroCenter: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  heroGlowOuter: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  heroGlowMid: {
    position: "absolute",
    width: 182,
    height: 182,
    borderRadius: 91,
  },
  heroIconShell: {
    width: 156,
    height: 156,
    borderRadius: 78,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 20,
  },
  heroTextWrap: {
    gap: 12,
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
    color: "#F5F7FF",
    letterSpacing: -0.8,
  },
  description: {
    fontSize: 15,
    lineHeight: 23,
    color: "rgba(233,237,247,0.75)",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  metaItem: {
    flex: 1,
    gap: 5,
  },
  metaLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.3,
    color: "rgba(233,237,247,0.5)",
    fontWeight: "700",
  },
  metaValue: {
    fontSize: 15,
    color: Colors.light.text,
    fontWeight: "700",
  },
  metaDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    minWidth: 8,
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
    gap: 12,
  },
  bannerCard: {
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
  },
  bannerBlur: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  bannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  regenSection: {
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 4,
  },
  regenBlur: {
    padding: 16,
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  regenLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  regenLabel: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.6)",
    fontWeight: "800",
  },
  regenInput: {
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.light.text,
    borderWidth: 1,
    minHeight: 64,
    textAlignVertical: "top",
  },
  regenBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  regenBtnText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  challengeCardWrap: {
    borderRadius: 24,
    overflow: "hidden",
  },
  challengeCardPressed: {
    opacity: 0.94,
  },
  challengeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 24,
    minHeight: 92,
  },
  challengeLocked: {
    opacity: 0.5,
  },
  challengeLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 14,
    paddingRight: 12,
  },
  checkOrb: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  challengeTextBlock: {
    flex: 1,
    gap: 4,
  },
  challengeTitle: {
    fontSize: 16,
    lineHeight: 20,
    color: Colors.light.text,
    fontWeight: "700",
  },
  challengeTitleDone: {
    color: "rgba(232,235,247,0.55)",
    textDecorationLine: "line-through",
  },
  challengeDetail: {
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(232,235,247,0.66)",
  },
  challengeRight: {
    alignItems: "flex-end",
  },
  xpPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: 999,
  },
  xpPillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  footerSpace: {
    height: 28,
  },
  challengeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  fixedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  fixedBadgeText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  verifiedBadgeText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  typeTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  typeTagText: {
    fontSize: 11,
    fontWeight: "700",
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: 999,
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  fitnessForm: {
    marginTop: 8,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 16,
    gap: 10,
  },
  fitnessFormLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#4A5680",
  },
  fitnessFormHint: {
    fontSize: 12,
    lineHeight: 17,
    color: "rgba(232,235,247,0.6)",
  },
  fitnessInput: {
    borderWidth: 1,
    borderColor: "rgba(93,225,255,0.10)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: "700",
    color: "#F0F4FF",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  fitnessSubmitBtn: {
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  fitnessSubmitText: {
    fontSize: 14,
    fontWeight: "800",
  },
});