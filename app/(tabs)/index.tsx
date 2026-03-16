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
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import Svg, { Circle as SvgCircle, Path } from "react-native-svg";
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

type IconComp = React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
type TreePoint = { x: number; y: number };
type DomainId = "mind" | "body" | "craft";
type SkillNodeItem = (typeof SKILL_NODES)[0];

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

const TREE_TOP_PADDING = 320;
const LEVEL_SPACING = 330;
const ORIGIN_BOTTOM_PADDING = 320;
const ORIGIN_SIZE = 128;
const NODE_SIZE = 90;
const GLOW_SIZE = 156;
const LABEL_WIDTH = 132;
const HEADER_HEIGHT = 220;
const DOMAIN_BOUNDS: Record<DomainId, [number, number]> = {
  mind: [0.1, 0.3],
  body: [0.4, 0.6],
  craft: [0.7, 0.9],
};

function alpha(hexColor: string, value: string): string {
  return `${hexColor}${value}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function ProgressRing({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.min(completed / total, 1) : 0;
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const filled = pct * circumference;

  return (
    <View style={ringStyles.wrap}>
      <BlurView tint="dark" intensity={70} style={ringStyles.blur}>
        <Svg width={78} height={78}>
          <SvgCircle cx={39} cy={39} r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth={5} fill="none" />
          <SvgCircle
            cx={39}
            cy={39}
            r={radius}
            stroke={Colors.light.tint}
            strokeWidth={5}
            fill="none"
            strokeDasharray={[filled, circumference - filled]}
            strokeDashoffset={circumference / 4}
            strokeLinecap="round"
          />
        </Svg>
        <View style={ringStyles.inner}>
          <Text style={ringStyles.pct}>{Math.round(pct * 100)}%</Text>
          <Text style={ringStyles.count}>{completed}/{total}</Text>
        </View>
      </BlurView>
    </View>
  );
}

function GlowLayers({ color, complete }: { color: string; complete: boolean }) {
  return (
    <>
      <View pointerEvents="none" style={[styles.glowOuter, { backgroundColor: alpha(color, complete ? "15" : "0D") }]} />
      <View pointerEvents="none" style={[styles.glowMid, { backgroundColor: alpha(color, complete ? "1B" : "10") }]} />
      <View pointerEvents="none" style={[styles.glowInner, { borderColor: alpha(color, complete ? "3A" : "26") }]} />
    </>
  );
}

function NodeBubble({
  node,
  point,
  unlocked,
  complete,
  hasProgress,
  onPress,
}: {
  node: SkillNodeItem;
  point: TreePoint;
  unlocked: boolean;
  complete: boolean;
  hasProgress: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const color = DOMAIN_COLOR[node.domainId];
  const Icon = ICON_MAP[node.icon];

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.93,
      useNativeDriver: true,
      tension: 250,
      friction: 12,
    }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 180,
      friction: 8,
    }).start();
  }, [scale]);

  return (
    <>
      <View
        style={[
          styles.nodeWrap,
          {
            left: point.x - GLOW_SIZE / 2,
            top: point.y - GLOW_SIZE / 2,
          },
        ]}
      >
        {unlocked ? <GlowLayers color={color} complete={complete} /> : null}
        <Animated.View style={{ transform: [{ scale }] }}>
          <Pressable
            testID={`node-${node.id}`}
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={[
              styles.nodeCore,
              {
                width: NODE_SIZE,
                height: NODE_SIZE,
                borderRadius: NODE_SIZE / 2,
                borderColor: unlocked ? alpha(color, complete ? "E8" : "78") : "rgba(255,255,255,0.08)",
                backgroundColor: unlocked ? alpha(color, complete ? "18" : "10") : "rgba(8,11,19,0.88)",
                opacity: unlocked ? 1 : 0.58,
              },
            ]}
          >
            <View style={[styles.nodeAndroidShadowOne, { backgroundColor: alpha(color, unlocked ? "10" : "06") }]} />
            <View style={[styles.nodeAndroidShadowTwo, { backgroundColor: alpha(color, unlocked ? "16" : "08") }]} />
            <View style={[styles.nodeInnerRing, { borderColor: unlocked ? alpha(color, complete ? "5A" : "2A") : "rgba(255,255,255,0.06)" }]} />
            {unlocked && Icon ? (
              <Icon size={30} color={complete ? color : alpha(color, "EA")} strokeWidth={2.2} />
            ) : (
              <Lock size={18} color="#4D5678" strokeWidth={2.1} />
            )}
            {hasProgress ? <View style={[styles.progressDot, { backgroundColor: color }]} /> : null}
            {complete ? (
              <View style={[styles.completeBadge, { backgroundColor: color, borderColor: "#08101A" }]}>
                <Text style={styles.completeBadgeCheck}>✓</Text>
              </View>
            ) : null}
          </Pressable>
        </Animated.View>
      </View>

      <View
        pointerEvents="none"
        style={[
          styles.labelWrap,
          {
            left: point.x - LABEL_WIDTH / 2,
            top: point.y + NODE_SIZE / 2 + 16,
            width: LABEL_WIDTH,
          },
        ]}
      >
        <Text style={[styles.nodeLabel, { color: unlocked ? Colors.light.text : "#66708D" }]} numberOfLines={2}>
          {node.title}
        </Text>
      </View>
    </>
  );
}

export default function TreeScreen() {
  const { width, height } = useWindowDimensions();
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
  const [selectedNode, setSelectedNode] = useState<SkillNodeItem | null>(null);
  const [canvasReady, setCanvasReady] = useState<boolean>(false);

  useEffect(() => {
    analytics.track(ANALYTICS_EVENTS.ONBOARDING_STARTED);
  }, []);

  const verticalScrollRef = useRef<ScrollView>(null);
  const horizontalScrollRef = useRef<ScrollView>(null);
  const hasCentered = useRef(false);
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
      console.log("[onboard] Building challenge tree from default challenges");
      try {
        await new Promise<void>((resolve) => setTimeout(resolve, 1400));
        const allGenerated: Record<string, Challenge[]> = {};
        SKILL_NODES.forEach((node) => {
          allGenerated[node.id] = node.defaultChallenges;
        });
        console.log("[onboard] Built challenges for", Object.keys(allGenerated).length, "nodes");
        completeOnboarding(answers, allGenerated);
      } catch (error) {
        console.error("[onboard] Generation failed:", error);
        setGenerateError("Failed to generate. Tap retry.");
      } finally {
        setGeneratingChallenges(false);
      }
    },
    [completeOnboarding]
  );

  const currentLevel = getUserLevel(state.xp);
  const xpCurrent = getXpForCurrentLevel(currentLevel);
  const xpNext = getXpForNextLevel(currentLevel);
  const xpProgress = xpNext > xpCurrent ? (state.xp - xpCurrent) / (xpNext - xpCurrent) : 1;
  const currentPrestigeRank = getPrestigeRank(state.prestigeCount);
  const prestigeBonusLabel = getPrestigeBonusLabel(state.prestigeCount);
  const maxTreeLevel = TREE_LEVELS[TREE_LEVELS.length - 1]?.number ?? 1;
  const canvasWidth = Math.max(width * 2.5, 1100);
  const originY = TREE_TOP_PADDING + maxTreeLevel * LEVEL_SPACING;
  const canvasHeight = originY + ORIGIN_BOTTOM_PADDING;
  const originPoint = useMemo<TreePoint>(() => ({ x: canvasWidth * 0.5, y: originY }), [canvasWidth, originY]);

  const centerOrigin = useCallback(
    (animated: boolean) => {
      const x = Math.max(originPoint.x - width / 2, 0);
      const y = Math.max(originPoint.y - height * 0.62, 0);
      console.log("[tree] Center origin", { x, y, animated });
      horizontalScrollRef.current?.scrollTo({ x, y: 0, animated });
      verticalScrollRef.current?.scrollTo({ x: 0, y, animated });
    },
    [height, originPoint.x, originPoint.y, width]
  );

  const nodePositions = useMemo<Record<string, TreePoint>>(() => {
    return SKILL_NODES.reduce<Record<string, TreePoint>>((accumulator, node) => {
      const bounds = DOMAIN_BOUNDS[node.domainId];
      const clampedXFrac = clamp(node.xFrac, bounds[0], bounds[1]);
      const domainCenter = (bounds[0] + bounds[1]) / 2;
      const domainDrift = (clampedXFrac - domainCenter) * 0.9;
      const levelOffset = ((node.levelNumber % 2) - 0.5) * 18;
      accumulator[node.id] = {
        x: canvasWidth * (domainCenter + domainDrift),
        y: originY - node.levelNumber * LEVEL_SPACING + levelOffset,
      };
      return accumulator;
    }, {});
  }, [canvasWidth, originY]);

  const connections = useMemo(() => {
    return SKILL_NODES.flatMap((node) => {
      const parents = node.parentIds.length > 0 ? node.parentIds : ["origin"];
      return parents.map((parentId) => ({ parentId, nodeId: node.id }));
    });
  }, []);

  const handleCanvasReady = useCallback(() => {
    if (!hasCentered.current && state.onboardingComplete) {
      centerOrigin(false);
      hasCentered.current = true;
      setCanvasReady(true);
    }
  }, [centerOrigin, state.onboardingComplete]);

  if (!state.isAuthed) {
    return (
      <View style={styles.shell}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.authHero}>
              <Text style={styles.brand}>SkillTree</Text>
              <Text style={styles.authTitle}>Become who{"\n"}you&apos;re meant to be.</Text>
              <Text style={styles.authSub}>
                A gamified skill tree that adapts to your goals and tracks your growth.
              </Text>
            </View>
            <BlurView tint="dark" intensity={75} style={styles.authCard}>
              <Text style={styles.authCardLabel}>What should we call you?</Text>
              <TextInput
                style={styles.authInput}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Enter your name"
                placeholderTextColor="#6C7699"
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
            </BlurView>
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
        <View style={styles.backgroundOrbTop} pointerEvents="none" />
        <View style={styles.backgroundOrbBottom} pointerEvents="none" />

        <View style={styles.headerWrap}>
          <BlurView tint="dark" intensity={80} style={styles.headerBlur}>
            <View style={styles.headerTopRow}>
              <View style={styles.headerLeft}>
                <Text style={styles.brand}>SkillTree</Text>
                <View style={styles.greetingRow}>
                  <Text style={styles.greeting}>Hey {state.displayName || "Adventurer"}</Text>
                  {state.isPro ? (
                    <View style={styles.proBadge}>
                      <Text style={styles.proBadgeText}>PRO</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.headerSubcopy}>Your growth map is now a wide, scrollable world.</Text>
              </View>
              <ProgressRing completed={completedChallenges} total={totalChallenges} />
            </View>

            <View style={styles.rankRow}>
              <View
                style={[
                  styles.rankPill,
                  {
                    borderColor: alpha(currentPrestigeRank.color, "38"),
                    backgroundColor: alpha(currentPrestigeRank.color, "14"),
                  },
                ]}
              >
                <Trophy size={12} color={currentPrestigeRank.color} strokeWidth={2.2} />
                <Text style={[styles.rankPillText, { color: currentPrestigeRank.color }]}>{currentPrestigeRank.name}</Text>
              </View>
              <Text style={styles.rankHint}>{prestigeBonusLabel}</Text>
            </View>

            <View style={styles.legendWrap}>
              {(["mind", "body", "craft"] as const).map((domain) => (
                <View key={domain} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: DOMAIN_COLOR[domain] }]} />
                  <Text style={styles.legendLabel}>{DOMAIN_LABEL[domain]}</Text>
                </View>
              ))}
            </View>

            <View style={styles.xpBarWrap}>
              <View style={styles.xpBarTrack}>
                <View style={[styles.xpBarFill, { width: `${Math.min(xpProgress * 100, 100)}%` as `${number}%` }]} />
              </View>
              <Text style={styles.xpBarLabel}>
                LV{currentLevel} · {Math.max(0, state.xp - xpCurrent)} / {Math.max(0, xpNext - xpCurrent)} XP to next level
              </Text>
            </View>
          </BlurView>
        </View>

        <Animated.View style={[styles.xpFlash, { opacity: xpFlashAnim }]} pointerEvents="none">
          <BlurView tint="dark" intensity={70} style={styles.xpFlashBubble}>
            <Zap size={14} color={Colors.light.tint} strokeWidth={2.5} />
            <Text style={styles.xpFlashText}>+{xpGained} XP</Text>
          </BlurView>
        </Animated.View>

        <ScrollView
          ref={verticalScrollRef}
          style={styles.verticalScroll}
          contentContainerStyle={{ paddingTop: HEADER_HEIGHT, paddingBottom: 180 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={handleCanvasReady}
          testID="tree-vertical-scroll"
        >
          <ScrollView
            ref={horizontalScrollRef}
            horizontal
            bounces
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ width: canvasWidth }}
            testID="tree-horizontal-scroll"
          >
            <View style={{ width: canvasWidth, height: canvasHeight }}>
              <View
                pointerEvents="none"
                style={[
                  styles.originAura,
                  {
                    left: originPoint.x - 170,
                    top: originPoint.y - 170,
                  },
                ]}
              />

              <Svg width={canvasWidth} height={canvasHeight} style={StyleSheet.absoluteFillObject} pointerEvents="none">
                {connections.map(({ parentId, nodeId }) => {
                  const parentPoint = parentId === "origin" ? originPoint : nodePositions[parentId];
                  const childPoint = nodePositions[nodeId];
                  const childNode = SKILL_NODES.find((node) => node.id === nodeId);

                  if (!parentPoint || !childPoint || !childNode) {
                    return null;
                  }

                  const connectorActive = isNodeUnlocked(childNode.id) || isNodeComplete(parentId);
                  const color = DOMAIN_COLOR[childNode.domainId];
                  const dx = childPoint.x - parentPoint.x;
                  const dy = childPoint.y - parentPoint.y;
                  const controlOffsetX = dx * 0.32;
                  const controlOffsetY = Math.max(Math.abs(dy) * 0.18, 44);
                  const path = `M ${parentPoint.x} ${parentPoint.y} C ${parentPoint.x + controlOffsetX} ${parentPoint.y - controlOffsetY}, ${childPoint.x - controlOffsetX} ${childPoint.y + controlOffsetY}, ${childPoint.x} ${childPoint.y}`;

                  return (
                    <Path
                      key={`${parentId}-${nodeId}`}
                      d={path}
                      stroke={connectorActive ? alpha(color, "55") : "rgba(255,255,255,0.07)"}
                      strokeWidth={connectorActive ? 3 : 2}
                      strokeLinecap="round"
                      fill="none"
                    />
                  );
                })}
              </Svg>

              <View
                style={[
                  styles.originWrap,
                  {
                    left: originPoint.x - GLOW_SIZE / 2,
                    top: originPoint.y - GLOW_SIZE / 2,
                  },
                ]}
                pointerEvents="none"
              >
                <GlowLayers color={Colors.light.tint} complete />
                <View style={styles.originNode}>
                  <View style={styles.originNodeInner}>
                    <Zap size={38} color={Colors.light.tint} strokeWidth={2.2} />
                  </View>
                </View>
              </View>
              <View
                pointerEvents="none"
                style={[
                  styles.labelWrap,
                  {
                    left: originPoint.x - LABEL_WIDTH / 2,
                    top: originPoint.y + ORIGIN_SIZE / 2 + 18,
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
                const challenges = (state.aiChallenges[node.id] ?? []).length > 0 ? state.aiChallenges[node.id] : node.defaultChallenges;
                const completedCount = challenges.filter((challenge) => state.challengeProgress[challenge.id]).length;
                const hasProgress = completedCount > 0 && !complete;

                if (!point) {
                  return null;
                }

                return (
                  <NodeBubble
                    key={node.id}
                    node={node}
                    point={point}
                    unlocked={unlocked}
                    complete={complete}
                    hasProgress={hasProgress}
                    onPress={async () => {
                      if (!unlocked) {
                        return;
                      }

                      console.log("[tree] Open node", node.id);
                      await Haptics.selectionAsync();
                      setSelectedNode(node);
                    }}
                  />
                );
              })}
            </View>
          </ScrollView>
        </ScrollView>

        {canvasReady ? (
          <Pressable
            style={styles.centerButtonWrap}
            onPress={() => centerOrigin(true)}
            testID="center-origin-button"
          >
            <BlurView tint="dark" intensity={82} style={styles.centerButton}>
              <Zap size={16} color={Colors.light.tint} strokeWidth={2.4} />
              <Text style={styles.centerButtonText}>Center Origin</Text>
            </BlurView>
          </Pressable>
        ) : null}

        {selectedNode ? (
          <NodePanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            iconMap={ICON_MAP}
            flashXP={flashXP}
          />
        ) : null}
        <PrestigeModal />
      </SafeAreaView>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  wrap: { width: 82, height: 82, alignItems: "center", justifyContent: "center" },
  blur: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  inner: { position: "absolute", alignItems: "center" },
  pct: { fontSize: 15, fontWeight: "900", color: Colors.light.text },
  count: { fontSize: 10, fontWeight: "700", color: Colors.light.muted },
});

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#05070D" },
  safeArea: { flex: 1 },
  backgroundOrbTop: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "rgba(93,225,255,0.07)",
    top: -120,
    right: -80,
  },
  backgroundOrbBottom: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(167,139,250,0.08)",
    bottom: -80,
    left: -90,
  },
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
    borderRadius: 28,
    padding: 22,
    gap: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  authCardLabel: {
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: Colors.light.muted,
    fontWeight: "700",
  },
  authInput: {
    backgroundColor: "rgba(9,12,20,0.88)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  primaryBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnDisabled: { opacity: 0.35 },
  primaryBtnText: { fontSize: 16, fontWeight: "800", color: "#060810", letterSpacing: 0.3 },
  headerWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  headerBlur: {
    borderRadius: 30,
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  headerLeft: { flex: 1 },
  greetingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  greeting: { fontSize: 28, fontWeight: "800", color: Colors.light.text, letterSpacing: -0.8 },
  headerSubcopy: { marginTop: 8, fontSize: 13, lineHeight: 18, color: "rgba(232,235,247,0.7)" },
  proBadge: {
    backgroundColor: Colors.light.tint,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "center",
  },
  proBadgeText: { fontSize: 10, fontWeight: "900", color: "#060810", letterSpacing: 1 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 14 },
  rankPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  rankPillText: { fontSize: 11, fontWeight: "800" },
  rankHint: { fontSize: 11, color: Colors.light.muted, fontWeight: "600" },
  legendWrap: { flexDirection: "row", gap: 10, marginTop: 14 },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 12, fontWeight: "700", color: Colors.light.muted },
  xpBarWrap: { marginTop: 14, gap: 6 },
  xpBarTrack: { height: 8, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" },
  xpBarFill: { height: "100%", backgroundColor: Colors.light.tint, borderRadius: 999 },
  xpBarLabel: { fontSize: 11, color: "#97A1C3", fontWeight: "700" },
  xpFlash: {
    position: "absolute",
    top: HEADER_HEIGHT - 18,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 30,
  },
  xpFlashBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  xpFlashText: { fontSize: 14, fontWeight: "800", color: Colors.light.tint },
  verticalScroll: { flex: 1 },
  originAura: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 170,
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
    backgroundColor: alpha(Colors.light.tint, "14"),
    borderWidth: 2.5,
    borderColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  originNodeInner: {
    width: ORIGIN_SIZE - 22,
    height: ORIGIN_SIZE - 22,
    borderRadius: (ORIGIN_SIZE - 22) / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
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
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  glowInner: {
    position: "absolute",
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  nodeCore: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.24 : 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  nodeAndroidShadowOne: {
    position: "absolute",
    width: NODE_SIZE + 24,
    height: NODE_SIZE + 24,
    borderRadius: (NODE_SIZE + 24) / 2,
  },
  nodeAndroidShadowTwo: {
    position: "absolute",
    width: NODE_SIZE + 12,
    height: NODE_SIZE + 12,
    borderRadius: (NODE_SIZE + 12) / 2,
  },
  nodeInnerRing: {
    position: "absolute",
    top: 8,
    bottom: 8,
    left: 8,
    right: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  progressDot: {
    position: "absolute",
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 2,
    borderColor: "#060810",
    top: 7,
    right: 6,
  },
  completeBadge: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    top: -6,
    right: -4,
  },
  completeBadgeCheck: { fontSize: 10, fontWeight: "900", color: "#000" },
  labelWrap: { position: "absolute", alignItems: "center" },
  nodeLabel: { fontSize: 13, fontWeight: "800", textAlign: "center", lineHeight: 16 },
  originLabel: { color: Colors.light.text, fontSize: 16 },
  centerButtonWrap: {
    position: "absolute",
    right: 18,
    bottom: 96,
    zIndex: 25,
    borderRadius: 999,
    overflow: "hidden",
  },
  centerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  centerButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.light.text,
  },
});
