import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Circle as SvgCircle, Line as SvgLine } from "react-native-svg";
import {
  Activity,
  Award,
  Briefcase,
  ChevronRight,
  Eye,
  Flame,
  Hammer,
  Heart,
  Lightbulb,
  Lock,
  MoonStar,
  PenTool,
  Rocket,
  Sparkles,
  Star,
  Trophy,
  Wind,
  Zap,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import {
  Challenge,
  DOMAIN_COLOR,
  DOMAIN_LABEL,
  SKILL_NODES,
  TREE_LEVELS,
  getPrestigeBonusLabel,
  getPrestigeRank,
  getUserLevel,
  getXpForCurrentLevel,
  getXpForNextLevel,
} from "@/mocks/mvp-data";
import { useAppState, OnboardingAnswers } from "@/state/app-state";
import { analytics } from "@/utils/analytics";
import { ANALYTICS_EVENTS } from "@/utils/event-types";
import { OnboardingScreens } from "@/components/OnboardingScreens";
import { NodePanel } from "@/components/NodePanel";
import { PrestigeModal } from "@/components/PrestigeModal";
import { trpc } from "@/lib/trpc"; // <-- Added your tRPC import here

type IconComp = React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
type TreePoint = { x: number; y: number };

const ICON_MAP: Record<string, IconComp> = {
  Heart,
  Wind,
  Activity,
  Eye,
  Flame,
  Lightbulb,
  Sparkles,
  Hammer,
  Zap,
  Award,
  Trophy,
  Star,
  Rocket,
  MoonStar,
  Briefcase,
  PenTool,
};

const TREE_TOP_PADDING = 180;
const LEVEL_SPACING = 240;
const ORIGIN_BOTTOM_PADDING = 180;
const ORIGIN_SIZE = 90;
const NODE_SIZE = 60;
const GLOW_SIZE = 96;
const LABEL_WIDTH = 84;

function alpha(hexColor: string, value: string): string {
  return `${hexColor}${value}`;
}

function ProgressRing({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.min(completed / total, 1) : 0;
  const radius = 29;
  const circumference = 2 * Math.PI * radius;
  const filled = pct * circumference;

  return (
    <View style={ringStyles.wrap}>
      <Svg width={74} height={74}>
        <SvgCircle cx={37} cy={37} r={radius} stroke="#1A2550" strokeWidth={4} fill="none" />
        <SvgCircle
          cx={37}
          cy={37}
          r={radius}
          stroke={Colors.light.tint}
          strokeWidth={4}
          fill="none"
          strokeDasharray={[filled, circumference - filled]}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
        />
      </Svg>
      <View style={ringStyles.inner}>
        <Text style={ringStyles.pct}>{Math.round(pct * 100)}%</Text>
        <Text style={ringStyles.count}>
          {completed}/{total}
        </Text>
      </View>
    </View>
  );
}

function GlowLayers({ color, complete }: { color: string; complete: boolean }) {
  return (
    <>
      <View
        pointerEvents="none"
        style={[
          styles.glowOuter,
          {
            backgroundColor: alpha(color, complete ? "14" : "0D"),
            transform: [{ scale: complete ? 1.02 : 0.98 }],
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.glowMid,
          {
            backgroundColor: alpha(color, complete ? "20" : "15"),
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.glowInner,
          {
            borderColor: alpha(color, complete ? "50" : "30"),
          },
        ]}
      />
    </>
  );
}

export default function TreeScreen() {
  const { width } = useWindowDimensions();
  const {
    state,
    signIn,
    completeOnboarding,
    isNodeComplete,
    isNodeUnlocked,
    completedChallenges,
    totalChallenges,
  } = useAppState();

  const [nameInput, setNameInput] = useState<string>("");
  const [generatingChallenges, setGeneratingChallenges] = useState<boolean>(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<(typeof SKILL_NODES)[0] | null>(null);

  // Hook up to your actual AI backend endpoint here
  // If your router is named differently (e.g., ai.generateOnboarding), change it here!
  const generateTreeMutation = trpc.ai.generateTree.useMutation();

  useEffect(() => {
    analytics.track(ANALYTICS_EVENTS.ONBOARDING_STARTED);
  }, []);

  const scrollRef = useRef<ScrollView>(null);
  const hasScrolled = useRef(false);
  const xpFlashAnim = useRef(new Animated.Value(0)).current;
  const [xpGained, setXpGained] = useState<number>(0);

  const flashXP = useCallback(
    (amount: number) => {
      setXpGained(amount);
      xpFlashAnim.setValue(1);
      Animated.timing(xpFlashAnim, { toValue: 0, duration: 1800, useNativeDriver: true }).start();
    },
    [xpFlashAnim]
  );

  const generateOnboardingChallenges = useCallback(
    async (answers: OnboardingAnswers) => {
      setGeneratingChallenges(true);
      setGenerateError(null);
      console.log("[onboard] Sending user goals to OpenAI backend...");
      
      try {
        // Fire the actual request to your backend LLM
        const generatedNodes = await generateTreeMutation.mutateAsync({
          mind: answers.mind,
          body: answers.body,
          craft: answers.craft
        });
        
        const allGenerated: Record<string, Challenge[]> = {};
        
        SKILL_NODES.forEach((node) => {
          // If the AI returned custom challenges for this specific node ID, use them!
          // Otherwise, fall back to the defaults so the tree doesn't break.
          if (generatedNodes && generatedNodes[node.id]) {
            allGenerated[node.id] = generatedNodes[node.id];
          } else {
            allGenerated[node.id] = node.defaultChallenges;
          }
        });

        console.log("[onboard] Successfully built custom AI tree!");
        completeOnboarding(answers, allGenerated);
      } catch (error) {
        console.error("[onboard] OpenAI Generation failed:", error);
        setGenerateError("Failed to connect to AI. Tap retry.");
      } finally {
        setGeneratingChallenges(false);
      }
    },
    [completeOnboarding, generateTreeMutation]
  );

  const currentLevel = getUserLevel(state.xp);
  const xpCurrent = getXpForCurrentLevel(currentLevel);
  const xpNext = getXpForNextLevel(currentLevel);
  const xpProgress = xpNext > xpCurrent ? (state.xp - xpCurrent) / (xpNext - xpCurrent) : 1;
  const currentPrestigeRank = getPrestigeRank(state.prestigeCount);
  const prestigeBonusLabel = getPrestigeBonusLabel(state.prestigeCount);
  const maxTreeLevel = TREE_LEVELS[TREE_LEVELS.length - 1]?.number ?? 1;
  const originY = TREE_TOP_PADDING + maxTreeLevel * LEVEL_SPACING;
  const canvasHeight = originY + ORIGIN_BOTTOM_PADDING;

  const nodePositions = useMemo<Record<string, TreePoint>>(() => {
    return SKILL_NODES.reduce<Record<string, TreePoint>>((accumulator, node) => {
      accumulator[node.id] = {
        x: width * node.xFrac,
        y: originY - node.levelNumber * LEVEL_SPACING,
      };
      return accumulator;
    }, {});
  }, [originY, width]);

  const connections = useMemo(() => {
    return SKILL_NODES.flatMap((node) => {
      const parents = node.parentIds.length > 0 ? node.parentIds : ["origin"];
      return parents.map((parentId) => ({ parentId, nodeId: node.id }));
    });
  }, []);

  const handleContentSizeChange = useCallback(() => {
    if (!hasScrolled.current) {
      scrollRef.current?.scrollToEnd({ animated: false });
      hasScrolled.current = true;
    }
  }, []);

  if (!state.isAuthed) {
    return (
      <View style={styles.shell}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.authHero}>
              <Text style={styles.brand}>SkillTree</Text>
              <Text style={styles.authTitle}>Become who{"\n"}you're meant to be.</Text>
              <Text style={styles.authSub}>
                A gamified skill tree that adapts to your goals and tracks your growth.
              </Text>
            </View>
            <View style={styles.authCard}>
              <Text style={styles.authCardLabel}>What should we call you?</Text>
              <TextInput
                style={styles.authInput}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Enter your name"
                placeholderTextColor="#2A3560"
                autoCapitalize="words"
                testID="auth-name"
              />
              <TouchableOpacity
                style={[styles.primaryBtn, !nameInput.trim() && styles.primaryBtnDisabled]}
                onPress={() => signIn(nameInput.trim() || "Adventurer")}
                disabled={!nameInput.trim()}
                testID="auth-continue"
              >
                <Text style={styles.primaryBtnText}>Begin Journey</Text>
                <ChevronRight size={18} color="#060810" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
            <View style={styles.authFeatures}>
              {[
                "Branch your growth like an RPG",
                "Earn XP through real-world habits",
                "Prestige and rebuild stronger",
              ].map((feature) => (
                <View key={feature} style={styles.authFeatureRow}>
                  <View style={styles.authFeatureDot} />
                  <Text style={styles.authFeatureText}>{feature}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  if (!state.onboardingComplete) {
    return (
      <OnboardingScreens
        onComplete={generateOnboardingChallenges}
        isGenerating={generatingChallenges}
        generateError={generateError}
      />
    );
  }

  return (
    <View style={styles.shell}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.brand}>SkillTree</Text>
            <View style={styles.greetingRow}>
              <Text style={styles.greeting}>Hey {state.displayName || "Adventurer"}</Text>
              {state.isPro && (
                <View style={styles.proBadge}>
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
              )}
            </View>
            <View style={styles.rankRow}>
              <View style={[styles.rankPill, { borderColor: alpha(currentPrestigeRank.color, "35"), backgroundColor: alpha(currentPrestigeRank.color, "12") }]}>
                <Trophy size={11} color={currentPrestigeRank.color} strokeWidth={2} />
                <Text style={[styles.rankPillText, { color: currentPrestigeRank.color }]}>{currentPrestigeRank.name}</Text>
              </View>
              <Text style={styles.rankHint}>{prestigeBonusLabel}</Text>
            </View>
          </View>
          <ProgressRing completed={completedChallenges} total={totalChallenges} />
        </View>

        <View style={styles.legendWrap}>
          <View style={styles.legend}>
            {(["mind", "body", "craft"] as const).map((domain) => (
              <View key={domain} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: DOMAIN_COLOR[domain] }]} />
                <Text style={styles.legendLabel}>{DOMAIN_LABEL[domain]}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.treeHint}>Deeper branches unlock as parent nodes are completed.</Text>
        </View>

        <View style={styles.xpBarWrap}>
          <View style={styles.xpBarTrack}>
            <View style={[styles.xpBarFill, { width: `${Math.min(xpProgress * 100, 100)}%` as `${number}%` }]} />
          </View>
          <Text style={styles.xpBarLabel}>
            LV{currentLevel} · {Math.max(0, state.xp - xpCurrent)} / {Math.max(0, xpNext - xpCurrent)} XP to next level
          </Text>
        </View>

        <Animated.View style={[styles.xpFlash, { opacity: xpFlashAnim }]} pointerEvents="none">
          <Zap size={12} color={Colors.light.tint} strokeWidth={2.5} />
          <Text style={styles.xpFlashText}>+{xpGained} XP</Text>
        </Animated.View>

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={handleContentSizeChange}
        >
          <View style={{ width, height: canvasHeight }}>
            <View
              pointerEvents="none"
              style={[
                styles.originAura,
                {
                  left: width * 0.5 - 130,
                  top: originY - 130,
                },
              ]}
            />

            <Svg
              width={width}
              height={canvasHeight}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            >
              {connections.map(({ parentId, nodeId }) => {
                const parentPoint =
                  parentId === "origin"
                    ? { x: width * 0.5, y: originY }
                    : nodePositions[parentId];
                const childPoint = nodePositions[nodeId];
                const childNode = SKILL_NODES.find((node) => node.id === nodeId);

                if (!parentPoint || !childPoint || !childNode) {
                  return null;
                }

                const connectorActive = isNodeUnlocked(childNode.id) || isNodeComplete(parentId);
                const strokeColor = connectorActive
                  ? alpha(DOMAIN_COLOR[childNode.domainId], "48")
                  : "#141B2E";

                return (
                  <SvgLine
                    key={`${parentId}-${nodeId}`}
                    x1={parentPoint.x}
                    y1={parentPoint.y}
                    x2={childPoint.x}
                    y2={childPoint.y}
                    stroke={strokeColor}
                    strokeWidth={connectorActive ? 1.6 : 1.2}
                    strokeLinecap="round"
                  />
                );
              })}
            </Svg>

            <View
              style={[
                styles.originWrap,
                {
                  left: width * 0.5 - GLOW_SIZE / 2,
                  top: originY - GLOW_SIZE / 2,
                },
              ]}
              pointerEvents="none"
            >
              <GlowLayers color={Colors.light.tint} complete />
              <View style={styles.originNode}>
                <Zap size={30} color={Colors.light.tint} strokeWidth={2} />
              </View>
            </View>
            <View
              pointerEvents="none"
              style={[
                styles.labelWrap,
                {
                  left: width * 0.5 - LABEL_WIDTH / 2,
                  top: originY + ORIGIN_SIZE / 2 + 10,
                  width: LABEL_WIDTH,
                },
              ]}
            >
              <Text style={[styles.nodeLabel, styles.originLabel]}>Origin</Text>
            </View>

            {SKILL_NODES.map((node) => {
              const point = nodePositions[node.id];
              const unlocked = isNodeUnlocked(node.id);
              const complete = isNodeComplete(node.id);
              const color = DOMAIN_COLOR[node.domainId];
              const Icon = ICON_MAP[node.icon];
              const challenges = (state.aiChallenges[node.id] ?? []).length > 0 ? state.aiChallenges[node.id] : node.defaultChallenges;
              const completedCount = challenges.filter((challenge) => state.challengeProgress[challenge.id]).length;
              const hasProgress = completedCount > 0 && !complete;

              if (!point) {
                return null;
              }

              return (
                <React.Fragment key={node.id}>
                  <View
                    style={[
                      styles.nodeWrap,
                      {
                        left: point.x - GLOW_SIZE / 2,
                        top: point.y - GLOW_SIZE / 2,
                      },
                    ]}
                  >
                    {unlocked && <GlowLayers color={color} complete={complete} />}
                    <Pressable
                      testID={`node-${node.id}`}
                      style={({ pressed }) => {
                        const pressedStyle =
                          Platform.OS === "android"
                            ? { opacity: pressed && unlocked ? 0.82 : 1 }
                            : pressed && unlocked
                              ? { opacity: 0.88, transform: [{ scale: 0.95 }] }
                              : null;

                        return [
                          styles.nodeCore,
                          {
                            width: NODE_SIZE,
                            height: NODE_SIZE,
                            borderRadius: NODE_SIZE / 2,
                            borderColor: unlocked ? alpha(color, complete ? "FF" : "82") : "#1A2240",
                            backgroundColor: unlocked ? alpha(color, complete ? "20" : "12") : "#0A0D18",
                            opacity: unlocked ? 1 : 0.55,
                          },
                          Platform.OS === "ios" && unlocked
                            ? {
                                shadowColor: color,
                                shadowOpacity: complete ? 0.18 : 0.12,
                                shadowRadius: complete ? 14 : 10,
                                shadowOffset: { width: 0, height: 0 },
                              }
                            : null,
                          pressedStyle,
                        ];
                      }}
                      onPress={() => {
                        if (unlocked) {
                          setSelectedNode(node);
                        }
                      }}
                    >
                      <View style={[styles.nodeInnerRing, { borderColor: unlocked ? alpha(color, complete ? "50" : "30") : "#141B2E" }]} />
                      {unlocked && Icon ? (
                        <Icon size={24} color={complete ? color : alpha(color, "E0")} strokeWidth={2} />
                      ) : (
                        <Lock size={15} color="#2A3050" strokeWidth={2} />
                      )}

                      {hasProgress && <View style={[styles.progressDot, { backgroundColor: color }]} />}

                      {complete && (
                        <View style={[styles.completeBadge, { backgroundColor: color, borderColor: "#060810" }]}>
                          <Text style={styles.completeBadgeCheck}>✓</Text>
                        </View>
                      )}
                    </Pressable>
                  </View>

                  <View
                    pointerEvents="none"
                    style={[
                      styles.labelWrap,
                      {
                        left: point.x - LABEL_WIDTH / 2,
                        top: point.y + NODE_SIZE / 2 + 10,
                        width: LABEL_WIDTH,
                      },
                    ]}
                  >
                    <Text style={[styles.nodeLabel, { color: unlocked ? Colors.light.text : "#2A3050" }]} numberOfLines={2}>
                      {node.title}
                    </Text>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        </ScrollView>

        {selectedNode && (
          <NodePanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            iconMap={ICON_MAP}
            flashXP={flashXP}
          />
        )}
        <PrestigeModal />
      </SafeAreaView>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  wrap: { width: 74, height: 74, alignItems: "center", justifyContent: "center" },
  inner: { position: "absolute", alignItems: "center" },
  pct: { fontSize: 15, fontWeight: "900", color: Colors.light.text },
  count: { fontSize: 9, fontWeight: "600", color: Colors.light.muted },
});

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#060810" },
  safeArea: { flex: 1 },
  authScroll: { padding: 24, paddingTop: 52, gap: 28, flexGrow: 1 },
  authHero: { gap: 12 },
  brand: {
    fontSize: 11,
    letterSpacing: 3.5,
    color: Colors.light.tint,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  authTitle: { fontSize: 40, fontWeight: "800", color: Colors.light.text, lineHeight: 46 },
  authSub: { fontSize: 15, color: Colors.light.muted, lineHeight: 24 },
  authCard: {
    backgroundColor: "#0C1120",
    borderRadius: 24,
    padding: 22,
    gap: 16,
    borderWidth: 1,
    borderColor: "#1A2238",
  },
  authCardLabel: {
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: Colors.light.muted,
    fontWeight: "700",
  },
  authInput: {
    backgroundColor: "#060810",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: "#1A2238",
  },
  authFeatures: { gap: 10 },
  authFeatureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  authFeatureDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.light.tint },
  authFeatureText: { fontSize: 14, color: Colors.light.muted, fontWeight: "500" },
  primaryBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: Colors.light.tint,
    shadowOpacity: Platform.OS === "ios" ? 0.3 : 0,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  primaryBtnDisabled: { opacity: 0.35 },
  primaryBtnText: { fontSize: 16, fontWeight: "800", color: "#060810", letterSpacing: 0.3 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 6,
  },
  headerLeft: { flex: 1, paddingRight: 14 },
  greetingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  greeting: { fontSize: 24, fontWeight: "900", color: Colors.light.text },
  proBadge: {
    backgroundColor: Colors.light.tint,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignSelf: "center",
  },
  proBadgeText: { fontSize: 10, fontWeight: "900", color: "#060810", letterSpacing: 1 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 },
  rankPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  rankPillText: { fontSize: 11, fontWeight: "800" },
  rankHint: { fontSize: 11, color: Colors.light.muted, fontWeight: "600" },
  legendWrap: { paddingTop: 4, paddingBottom: 8 },
  legend: { flexDirection: "row", justifyContent: "center", gap: 22 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 7 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 13, fontWeight: "600", color: Colors.light.muted },
  treeHint: { textAlign: "center", marginTop: 8, fontSize: 11, color: "#4B567A", fontWeight: "600" },
  xpBarWrap: { paddingHorizontal: 22, paddingBottom: 10, gap: 5 },
  xpBarTrack: { height: 4, backgroundColor: "#111828", borderRadius: 999, overflow: "hidden" },
  xpBarFill: { height: "100%", backgroundColor: Colors.light.tint, borderRadius: 999 },
  xpBarLabel: { fontSize: 10, color: "#62709A", fontWeight: "700" },
  xpFlash: {
    position: "absolute",
    top: 164,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  xpFlashText: { fontSize: 15, fontWeight: "800", color: Colors.light.tint },
  originAura: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: alpha(Colors.light.tint, "08"),
  },
  originWrap: {
    position: "absolute",
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  originNode: {
    width: ORIGIN_SIZE,
    height: ORIGIN_SIZE,
    borderRadius: ORIGIN_SIZE / 2,
    backgroundColor: alpha(Colors.light.tint, "16"),
    borderWidth: 2.5,
    borderColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: Colors.light.tint,
          shadowOpacity: 0.22,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 0 },
        }
      : {}),
  },
  nodeWrap: {
    position: "absolute",
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  glowOuter: {
    position: "absolute",
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
  },
  glowMid: {
    position: "absolute",
    width: 78,
    height: 78,
    borderRadius: 39,
  },
  glowInner: {
    position: "absolute",
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  nodeCore: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    overflow: "hidden",
  },
  nodeInnerRing: {
    position: "absolute",
    inset: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  progressDot: {
    position: "absolute",
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#060810",
    top: 5,
    right: 3,
  },
  completeBadge: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    top: -6,
    right: -6,
  },
  completeBadgeCheck: { fontSize: 9, fontWeight: "900", color: "#000" },
  labelWrap: { position: "absolute", alignItems: "center" },
  nodeLabel: { fontSize: 12, fontWeight: "800", textAlign: "center", lineHeight: 14 },
  originLabel: { color: Colors.light.text, fontSize: 14 },
});