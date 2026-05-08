import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  SafeAreaView,
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
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Eye,
  Flame,
  Hammer,
  Heart,
  Lightbulb,
  Lock,
  Minus,
  MoonStar,
  PenTool,
  Plus,
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
import { trpc } from "@/lib/trpc";
import { PanZoomCanvas, PanZoomCanvasRef } from "../../components/PanZoomCanvas";

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

const TREE_TOP_PADDING = 340;
const LEVEL_SPACING = 380;
const ORIGIN_BOTTOM_PADDING = 360;
const ORIGIN_SIZE = 128;
const NODE_SIZE = 94;
const GLOW_SIZE = 170;
const HEADER_EXPANDED_HEIGHT = 232;
const HEADER_COLLAPSED_HEIGHT = 86;
const MIN_MAP_SCALE = 0.5;
const MAX_MAP_SCALE = 2.0;
const LINE_GLOW_WIDTH = 10;
const LINE_CORE_WIDTH = 4.5;
const LABEL_PILL_WIDTH = 132;
const LABEL_CONNECTOR_HEIGHT = 16;
const APP_BACKGROUND = "#080D1A";
const DOMAIN_BOUNDS: Record<DomainId, [number, number]> = {
  mind: [0.1, 0.3],
  body: [0.45, 0.55],
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
          <SvgCircle
            cx={39}
            cy={39}
            r={radius}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={5}
            fill="none"
          />
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
          <Text style={ringStyles.count}>
            {completed}/{total}
          </Text>
        </View>
      </BlurView>
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
          { backgroundColor: alpha(color, complete ? "15" : "0D") },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.glowMid,
          { backgroundColor: alpha(color, complete ? "1B" : "10") },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.glowInner,
          { borderColor: alpha(color, complete ? "3A" : "26") },
        ]}
      />
    </>
  );
}

function NodeBubble({
  node,
  point,
  unlocked,
  complete,
  hasProgress,
  focused,
  onPress,
}: {
  node: SkillNodeItem;
  point: TreePoint;
  unlocked: boolean;
  complete: boolean;
  hasProgress: boolean;
  focused: boolean;
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
        {focused ? (
          <View
            pointerEvents="none"
            style={[
              styles.focusHalo,
              {
                borderColor: alpha(color, "68"),
                backgroundColor: alpha(color, "12"),
              },
            ]}
          />
        ) : null}
        <Animated.View
          style={{
            transform: [{ scale: focused ? Animated.multiply(scale, 1.04) : scale }],
          }}
        >
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
                borderColor: unlocked
                  ? alpha(color, complete ? "E8" : "78")
                  : "rgba(255,255,255,0.08)",
                backgroundColor: unlocked
                  ? alpha(color, complete ? "18" : "10")
                  : "rgba(8,11,19,0.88)",
                opacity: unlocked ? 1 : 0.58,
              },
            ]}
          >
            <View
              style={[
                styles.nodeAndroidShadowOne,
                { backgroundColor: alpha(color, unlocked ? "10" : "06") },
              ]}
            />
            <View
              style={[
                styles.nodeAndroidShadowTwo,
                { backgroundColor: alpha(color, unlocked ? "16" : "08") },
              ]}
            />
            <View
              style={[
                styles.nodeInnerRing,
                {
                  borderColor: unlocked
                    ? alpha(color, complete ? "5A" : "2A")
                    : "rgba(255,255,255,0.06)",
                },
              ]}
            />
            {unlocked && Icon ? (
              <Icon
                size={30}
                color={complete ? color : alpha(color, "EA")}
                strokeWidth={2.2}
              />
            ) : (
              <Lock size={18} color="#4D5678" strokeWidth={2.1} />
            )}
            {hasProgress ? (
              <View style={[styles.progressDot, { backgroundColor: color }]} />
            ) : null}
            {complete ? (
              <View
                style={[
                  styles.completeBadge,
                  { backgroundColor: color, borderColor: "#08101A" },
                ]}
              >
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
            left: point.x - LABEL_PILL_WIDTH / 2,
            top: point.y + NODE_SIZE / 2 + 18,
            width: LABEL_PILL_WIDTH,
          },
        ]}
      >
        <View
          style={[
            styles.labelConnector,
            {
              backgroundColor: unlocked
                ? alpha(color, "55")
                : "rgba(255,255,255,0.12)",
            },
          ]}
        />
        <View
          style={[
            styles.nodeLabelPill,
            {
              backgroundColor: unlocked
                ? alpha(color, "16")
                : "rgba(255,255,255,0.05)",
              borderColor: unlocked
                ? alpha(color, "28")
                : "rgba(255,255,255,0.08)",
            },
          ]}
        >
          <Text
            style={[
              styles.nodeLabel,
              { color: unlocked ? Colors.light.text : "#7480A1" },
            ]}
            numberOfLines={2}
          >
            {node.title}
          </Text>
        </View>
      </View>
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
  const [selectedNode, setSelectedNode] = useState<SkillNodeItem | null>(null);
  const [canvasReady, setCanvasReady] = useState<boolean>(false);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Layout State
  const [headerCollapsed, setHeaderCollapsed] = useState<boolean>(false);
  const headerExpandAnim = useRef(new Animated.Value(1)).current;

  const hasCentered = useRef(false);
  const canvasRef = useRef<PanZoomCanvasRef>(null);

  const generateTreeMutation = trpc.ai.generateTree.useMutation();

  useEffect(() => {
    analytics.track(ANALYTICS_EVENTS.ONBOARDING_STARTED);
  }, []);

  const xpFlashAnim = useRef(new Animated.Value(0)).current;
  const orbTopScaleAnim = useRef(new Animated.Value(1)).current;
  const orbTopDriftXAnim = useRef(new Animated.Value(0)).current;
  const orbTopDriftYAnim = useRef(new Animated.Value(0)).current;
  const orbBottomScaleAnim = useRef(new Animated.Value(1)).current;
  const orbBottomDriftXAnim = useRef(new Animated.Value(0)).current;
  const orbBottomDriftYAnim = useRef(new Animated.Value(0)).current;
  const [xpGained, setXpGained] = useState<number>(0);
  const [focusedNodeId, setFocusedNodeId] = useState<string>("calm");

  const handleZoom = useCallback((direction: 1 | -1) => {
    canvasRef.current?.zoomBy(direction * 0.2, true);
  }, []);

  const flashXP = useCallback(
    (amount: number) => {
      setXpGained(amount);
      xpFlashAnim.setValue(1);
      Animated.timing(xpFlashAnim, {
        toValue: 0,
        duration: 1800,
        useNativeDriver: true,
      }).start();
    },
    [xpFlashAnim]
  );

  const generateOnboardingChallenges = useCallback(
    async (answers: OnboardingAnswers) => {
      setGeneratingChallenges(true);
      setGenerateError(null);
      try {
        const generatedNodes = await generateTreeMutation.mutateAsync({
          mind: answers.mind,
          body: answers.body,
          craft: answers.craft,
        });

        const allGenerated: Record<string, Challenge[]> = {};
        SKILL_NODES.forEach((node) => {
          const generatedChallenges = generatedNodes?.[node.id as keyof typeof generatedNodes];
          if (generatedChallenges) {
            allGenerated[node.id] = generatedChallenges.map((challenge, index) => ({
              id: `ai-${node.id}-${index}-${Date.now()}`,
              nodeId: node.id,
              title: challenge.title,
              detail: challenge.detail,
              xp: challenge.xp,
            }));
          } else {
            allGenerated[node.id] = node.defaultChallenges;
          }
        });
        completeOnboarding(answers, allGenerated);
      } catch {
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
  const xpProgress =
    xpNext > xpCurrent ? (state.xp - xpCurrent) / (xpNext - xpCurrent) : 1;
  const currentPrestigeRank = getPrestigeRank(state.prestigeCount);
  const maxTreeLevel = TREE_LEVELS[TREE_LEVELS.length - 1]?.number ?? 1;

  // Semantic Zoom Math
  const baseCanvasWidth = Math.max(width * 3.4, 1680);
  const baseOriginY = TREE_TOP_PADDING + maxTreeLevel * LEVEL_SPACING;
  const baseCanvasHeight = baseOriginY + ORIGIN_BOTTOM_PADDING;
  const canvasWidth = baseCanvasWidth;
  const originY = baseOriginY;
  const canvasHeight = baseCanvasHeight;
  const headerHeight = headerCollapsed ? HEADER_COLLAPSED_HEIGHT : HEADER_EXPANDED_HEIGHT;

  const originPoint = useMemo<TreePoint>(
    () => ({ x: canvasWidth * 0.5, y: originY }),
    [canvasWidth, originY]
  );

  const centerOrigin = useCallback(
    (animated: boolean = true) => {
      if (viewportSize.width <= 0 || viewportSize.height <= 0) {
        return;
      }
      setFocusedNodeId("origin");
      canvasRef.current?.centerOn(
        originPoint.x,
        originPoint.y,
        animated
      );
    },
    [originPoint]
  );

  useEffect(() => {
    Animated.spring(headerExpandAnim, {
      toValue: headerCollapsed ? 0 : 1,
      useNativeDriver: false,
      tension: 170,
      friction: 20,
    }).start();
  }, [headerCollapsed, headerExpandAnim]);

  useEffect(() => {
    if (
      !hasCentered.current &&
      state.onboardingComplete &&
      viewportSize.width > 0 &&
      viewportSize.height > 0
    ) {
      setTimeout(() => {
        centerOrigin(false);
        hasCentered.current = true;
        setCanvasReady(true);
      }, 100);
    }
  }, [centerOrigin, state.onboardingComplete, viewportSize.height, viewportSize.width]);

  const nodePositions = useMemo<Record<string, TreePoint>>(() => {
    return SKILL_NODES.reduce<Record<string, TreePoint>>((accumulator, node) => {
      const bounds = DOMAIN_BOUNDS[node.domainId];
      const clampedXFrac = clamp(node.xFrac, bounds[0], bounds[1]);
      const siblings = SKILL_NODES.filter(
        (candidate) =>
          candidate.domainId === node.domainId &&
          candidate.levelNumber === node.levelNumber
      ).sort((left, right) => left.xFrac - right.xFrac);
      
      const siblingIndex = Math.max(
        siblings.findIndex((candidate) => candidate.id === node.id),
        0
      );
      const siblingSpread = siblings.length > 1 ? siblingIndex - (siblings.length - 1) / 2 : 0;
      const levelWave = (node.levelNumber % 2 === 0 ? 1 : -1) * 14;
      
      accumulator[node.id] = {
        x: canvasWidth * clampedXFrac,
        y: originY - node.levelNumber * LEVEL_SPACING + siblingSpread * 124 + levelWave,
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

  useEffect(() => {
    const topAnimation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(orbTopScaleAnim, {
            toValue: 1.15,
            duration: 4000,
            useNativeDriver: true,
          }),
          Animated.timing(orbTopDriftXAnim, {
            toValue: -18,
            duration: 4000,
            useNativeDriver: true,
          }),
          Animated.timing(orbTopDriftYAnim, {
            toValue: 14,
            duration: 4000,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(orbTopScaleAnim, {
            toValue: 1,
            duration: 4000,
            useNativeDriver: true,
          }),
          Animated.timing(orbTopDriftXAnim, {
            toValue: 8,
            duration: 4000,
            useNativeDriver: true,
          }),
          Animated.timing(orbTopDriftYAnim, {
            toValue: -10,
            duration: 4000,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    const bottomAnimation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(orbBottomScaleAnim, {
            toValue: 1.15,
            duration: 4000,
            useNativeDriver: true,
          }),
          Animated.timing(orbBottomDriftXAnim, {
            toValue: 16,
            duration: 4000,
            useNativeDriver: true,
          }),
          Animated.timing(orbBottomDriftYAnim, {
            toValue: -16,
            duration: 4000,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(orbBottomScaleAnim, {
            toValue: 1,
            duration: 4000,
            useNativeDriver: true,
          }),
          Animated.timing(orbBottomDriftXAnim, {
            toValue: -12,
            duration: 4000,
            useNativeDriver: true,
          }),
          Animated.timing(orbBottomDriftYAnim, {
            toValue: 10,
            duration: 4000,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    topAnimation.start();
    bottomAnimation.start();

    return () => {
      topAnimation.stop();
      bottomAnimation.stop();
    };
  }, [
    orbBottomDriftXAnim,
    orbBottomDriftYAnim,
    orbBottomScaleAnim,
    orbTopDriftXAnim,
    orbTopDriftYAnim,
    orbTopScaleAnim,
  ]);

  const backgroundOrbTopStyle = useMemo(
    () => ({
      transform: [
        { translateX: orbTopDriftXAnim },
        { translateY: orbTopDriftYAnim },
        { scale: orbTopScaleAnim },
      ],
    }),
    [orbTopDriftXAnim, orbTopDriftYAnim, orbTopScaleAnim]
  );

  const backgroundOrbBottomStyle = useMemo(
    () => ({
      transform: [
        { translateX: orbBottomDriftXAnim },
        { translateY: orbBottomDriftYAnim },
        { scale: orbBottomScaleAnim },
      ],
    }),
    [orbBottomDriftXAnim, orbBottomDriftYAnim, orbBottomScaleAnim]
  );

  if (!state.isAuthed) {
    return (
      <View style={styles.shell}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.authScroll}>
            <View style={styles.authHero}>
              <Text style={styles.brand}>SkillTree</Text>
              <Text style={styles.authTitle}>
                Become who{"\n"}you&apos;re meant to be.
              </Text>
              <Text style={styles.authSub}>
                A gamified skill tree that adapts to your goals and tracks your
                growth.
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
                style={[
                  styles.primaryBtn,
                  !nameInput.trim() && styles.primaryBtnDisabled,
                ]}
                onPress={() => signIn(nameInput.trim() || "Adventurer")}
                disabled={!nameInput.trim()}
                testID="auth-continue"
              >
                <Text style={styles.primaryBtnText}>Begin Journey</Text>
                <ChevronRight size={18} color="#060810" strokeWidth={2.5} />
              </TouchableOpacity>
            </BlurView>
          </View>
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
        <Animated.View
          style={[styles.backgroundOrbTop, backgroundOrbTopStyle]}
          pointerEvents="none"
        />
        <Animated.View
          style={[styles.backgroundOrbBottom, backgroundOrbBottomStyle]}
          pointerEvents="none"
        />

        <View style={styles.headerWrap} pointerEvents="box-none">
          <BlurView tint="dark" intensity={80} style={[styles.headerBlur, { minHeight: headerHeight }]}>
            <View style={styles.headerTopRow}>
              <View style={styles.headerLeft}>
                <Text style={styles.brand}>SkillTree</Text>
                <View style={styles.greetingRow}>
                  <Text style={styles.greeting}>
                    Hey {state.displayName || "Adventurer"}
                  </Text>
                  {state.isPro ? (
                    <View style={styles.proBadge}>
                      <Text style={styles.proBadgeText}>PRO</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={styles.headerTopActions}>
                <ProgressRing completed={completedChallenges} total={totalChallenges} />
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setHeaderCollapsed((current) => !current);
                  }}
                  style={styles.headerToggleButton}
                  testID="header-toggle-button"
                >
                  <Animated.View
                    style={{
                      transform: [
                        {
                          rotate: headerExpandAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ["0deg", "180deg"],
                          }),
                        },
                      ],
                    }}
                  >
                    <ChevronDown size={18} color="#F8FAFF" strokeWidth={2.4} />
                  </Animated.View>
                </Pressable>
              </View>
            </View>

            <Animated.View
              style={[
                styles.headerContent,
                {
                  opacity: headerExpandAnim,
                  maxHeight: headerExpandAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 220],
                  }),
                  transform: [
                    {
                      translateY: headerExpandAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-12, 0],
                      }),
                    },
                  ],
                },
              ]}
              pointerEvents={headerCollapsed ? "none" : "auto"}
            >
              <View style={styles.headerStatsRow}>
                <View style={styles.headerPrimaryStat}>
                  <Text style={styles.headerStatEyebrow}>Completed</Text>
                  <Text style={styles.headerStatValue}>
                    {completedChallenges}
                    <Text style={styles.headerStatMuted}>/{totalChallenges}</Text>
                  </Text>
                </View>
                <View style={styles.headerStatDivider} />
                <View style={styles.headerPrimaryStat}>
                  <Text style={styles.headerStatEyebrow}>Level</Text>
                  <Text style={styles.headerStatValue}>LV{currentLevel}</Text>
                </View>
                <View
                  style={[
                    styles.rankPill,
                    {
                      borderColor: alpha(currentPrestigeRank.color, "38"),
                      backgroundColor: alpha(currentPrestigeRank.color, "14"),
                    },
                  ]}
                >
                  <Trophy
                    size={12}
                    color={currentPrestigeRank.color}
                    strokeWidth={2.2}
                  />
                  <Text
                    style={[
                      styles.rankPillText,
                      { color: currentPrestigeRank.color },
                    ]}
                  >
                    {currentPrestigeRank.name}
                  </Text>
                </View>
              </View>

              <View style={styles.legendWrap}>
                {(["mind", "body", "craft"] as const).map((domain) => (
                  <View
                    key={domain}
                    style={[
                      styles.legendItem,
                      {
                        backgroundColor: alpha(DOMAIN_COLOR[domain], "14"),
                        borderColor: alpha(DOMAIN_COLOR[domain], "24"),
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: DOMAIN_COLOR[domain] },
                      ]}
                    />
                    <Text style={styles.legendLabel}>{DOMAIN_LABEL[domain]}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.xpBarWrap}>
                <Text style={styles.xpBarLabel}>
                  LV{currentLevel} · {Math.max(0, state.xp - xpCurrent)} /{" "}
                  {Math.max(0, xpNext - xpCurrent)} XP to next level
                </Text>
                <View style={styles.xpBarTrack}>
                  <View
                    style={[
                      styles.xpBarFill,
                      { width: `${Math.min(xpProgress * 100, 100)}%` as `${number}%` },
                    ]}
                  />
                </View>
              </View>
            </Animated.View>
          </BlurView>
        </View>

        <Animated.View
          style={[styles.xpFlash, { opacity: xpFlashAnim }]}
          pointerEvents="none"
        >
          <BlurView tint="dark" intensity={70} style={styles.xpFlashBubble}>
            <Zap size={14} color={Colors.light.tint} strokeWidth={2.5} />
            <Text style={styles.xpFlashText}>+{xpGained} XP</Text>
          </BlurView>
        </Animated.View>

        <View
          style={{ flex: 1, overflow: "hidden" }}
          onLayout={(event) => {
            const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
            setViewportSize((prev) => {
              if (prev.width === nextWidth && prev.height === nextHeight) {
                return prev;
              }
              return { width: nextWidth, height: nextHeight };
            });
          }}
        >
          <PanZoomCanvas
            ref={canvasRef}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            viewportWidth={viewportSize.width}
            viewportHeight={viewportSize.height}
            minScale={MIN_MAP_SCALE}
            maxScale={MAX_MAP_SCALE}
          >
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

            <Svg
              width={canvasWidth}
              height={canvasHeight}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            >
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
                  <React.Fragment key={`${parentId}-${nodeId}`}>
                    {connectorActive ? (
                      <Path
                        d={path}
                        stroke={alpha(color, "1E")}
                        strokeWidth={LINE_GLOW_WIDTH}
                        strokeLinecap="round"
                        fill="none"
                      />
                    ) : null}
                    <Path
                      d={path}
                      stroke={
                        connectorActive
                          ? alpha(color, "75")
                          : "rgba(255,255,255,0.11)"
                      }
                      strokeWidth={connectorActive ? LINE_CORE_WIDTH : 3}
                      strokeLinecap="round"
                      fill="none"
                    />
                  </React.Fragment>
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
              {focusedNodeId === "origin" ? (
                <View style={styles.originFocusHalo} />
              ) : null}
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
                  left: originPoint.x - LABEL_PILL_WIDTH / 2,
                  top: originPoint.y + ORIGIN_SIZE / 2 + 18,
                  width: LABEL_PILL_WIDTH,
                },
              ]}
            >
              <View
                style={[
                  styles.labelConnector,
                  { backgroundColor: alpha(Colors.light.tint, "65") },
                ]}
              />
              <View style={[styles.nodeLabelPill, styles.originLabelPill]}>
                <Text style={[styles.nodeLabel, styles.originLabel]}>Origin</Text>
              </View>
            </View>

            {SKILL_NODES.map((node) => {
              const point = nodePositions[node.id];
              const unlocked = isNodeUnlocked(node.id);
              const complete = isNodeComplete(node.id);
              const challenges =
                (state.aiChallenges[node.id] ?? []).length > 0
                  ? state.aiChallenges[node.id]
                  : node.defaultChallenges;
              const completedCount = challenges.filter(
                (challenge) => state.challengeProgress[challenge.id]
              ).length;
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
                  focused={focusedNodeId === node.id}
                  onPress={async () => {
                    if (!unlocked) {
                      return;
                    }
                    await Haptics.selectionAsync();
                    setSelectedNode(node);
                    setFocusedNodeId(node.id);
                    canvasRef.current?.centerOn(
                      point.x,
                      point.y,
                      true
                    );
                  }}
                />
              );
            })}
          </PanZoomCanvas>
        </View>

        {canvasReady ? (
          <>
            <Pressable
              style={styles.zoomControlsWrap}
              onPress={() => handleZoom(1)}
              testID="zoom-in-button"
            >
              <BlurView tint="dark" intensity={82} style={styles.zoomButton}>
                <Plus size={16} color={Colors.light.text} strokeWidth={2.5} />
              </BlurView>
            </Pressable>
            <Pressable
              style={styles.zoomControlsWrapBottom}
              onPress={() => handleZoom(-1)}
              testID="zoom-out-button"
            >
              <BlurView tint="dark" intensity={82} style={styles.zoomButton}>
                <Minus size={16} color={Colors.light.text} strokeWidth={2.5} />
              </BlurView>
            </Pressable>
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
          </>
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
  wrap: {
    width: 82,
    height: 82,
    alignItems: "center",
    justifyContent: "center",
  },
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
  inner: {
    position: "absolute",
    alignItems: "center",
  },
  pct: {
    fontFamily: "OutfitExtraBold",
    fontSize: 15,
    color: Colors.light.text,
  },
  count: {
    fontFamily: "OutfitSemiBold",
    fontSize: 10,
    color: Colors.light.muted,
  },
});

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: APP_BACKGROUND,
  },
  safeArea: {
    flex: 1,
  },
  backgroundOrbTop: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "rgba(93,225,255,0.09)",
    top: -120,
    right: -80,
  },
  backgroundOrbBottom: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(167,139,250,0.09)",
    bottom: -80,
    left: -90,
  },
  authScroll: {
    padding: 24,
    paddingTop: 52,
    gap: 28,
    flexGrow: 1,
  },
  authHero: {
    gap: 12,
  },
  brand: {
    fontFamily: "OutfitBlack",
    fontSize: 11,
    letterSpacing: 3.5,
    color: Colors.light.tint,
    textTransform: "uppercase",
  },
  authTitle: {
    fontFamily: "OutfitExtraBold",
    fontSize: 40,
    color: Colors.light.text,
    lineHeight: 46,
  },
  authSub: {
    fontFamily: "Outfit",
    fontSize: 15,
    color: Colors.light.muted,
    lineHeight: 24,
  },
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
    fontFamily: "OutfitBold",
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: Colors.light.muted,
  },
  authInput: {
    fontFamily: "Outfit",
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
  primaryBtnDisabled: {
    opacity: 0.35,
  },
  primaryBtnText: {
    fontFamily: "OutfitExtraBold",
    fontSize: 16,
    color: "#060810",
    letterSpacing: 0.3,
  },
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
    paddingBottom: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  headerLeft: {
    flex: 1,
  },
  headerTopActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerToggleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  headerContent: {
    overflow: "hidden",
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  greeting: {
    fontFamily: "OutfitExtraBold",
    fontSize: 28,
    color: "#F8FAFF",
    letterSpacing: -0.8,
  },
  proBadge: {
    backgroundColor: Colors.light.tint,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "center",
  },
  proBadgeText: {
    fontFamily: "OutfitBlack",
    fontSize: 10,
    color: "#060810",
    letterSpacing: 1,
  },
  headerStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
  },
  headerPrimaryStat: {
    flex: 1,
    gap: 4,
  },
  headerStatEyebrow: {
    fontFamily: "OutfitBold",
    fontSize: 11,
    color: "#97A3C8",
    textTransform: "uppercase",
    letterSpacing: 1.3,
  },
  headerStatValue: {
    fontFamily: "OutfitBlack",
    fontSize: 24,
    color: "#F8FAFF",
    letterSpacing: -0.6,
  },
  headerStatMuted: {
    fontFamily: "OutfitBold",
    color: "#9AA4C8",
  },
  headerStatDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  rankPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  rankPillText: {
    fontFamily: "OutfitExtraBold",
    fontSize: 11,
  },
  legendWrap: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    fontFamily: "OutfitExtraBold",
    fontSize: 12,
    color: "#E6ECFF",
  },
  xpBarWrap: {
    marginTop: 16,
    gap: 8,
  },
  xpBarTrack: {
    height: 11,
    backgroundColor: "rgba(255,255,255,0.11)",
    borderRadius: 999,
    overflow: "hidden",
  },
  xpBarFill: {
    height: "100%",
    backgroundColor: Colors.light.tint,
    borderRadius: 999,
  },
  xpBarLabel: {
    fontFamily: "OutfitExtraBold",
    fontSize: 14,
    color: "#E8F5FF",
  },
  collapseToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 14,
    paddingBottom: 4,
  },
  collapseText: {
    fontFamily: "OutfitBold",
    fontSize: 11,
    color: Colors.light.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  xpFlash: {
    position: "absolute",
    top: HEADER_EXPANDED_HEIGHT - 18,
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
  xpFlashText: {
    fontFamily: "OutfitExtraBold",
    fontSize: 14,
    color: Colors.light.tint,
  },
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
    zIndex: 3,
  },
  originFocusHalo: {
    position: "absolute",
    width: GLOW_SIZE + 16,
    height: GLOW_SIZE + 16,
    borderRadius: (GLOW_SIZE + 16) / 2,
    borderWidth: 1.5,
    borderColor: alpha(Colors.light.tint, "70"),
    backgroundColor: alpha(Colors.light.tint, "10"),
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
    zIndex: 3,
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
  focusHalo: {
    position: "absolute",
    width: GLOW_SIZE + 14,
    height: GLOW_SIZE + 14,
    borderRadius: (GLOW_SIZE + 14) / 2,
    borderWidth: 1.5,
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
  completeBadgeCheck: {
    fontFamily: "OutfitBlack",
    fontSize: 10,
    color: "#000",
  },
  labelWrap: {
    position: "absolute",
    alignItems: "center",
    zIndex: 4,
  },
  labelConnector: {
    width: 3,
    height: LABEL_CONNECTOR_HEIGHT,
    borderRadius: 999,
    marginBottom: 8,
  },
  nodeLabelPill: {
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
  },
  nodeLabel: {
    fontFamily: "OutfitExtraBold",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 17,
  },
  originLabelPill: {
    backgroundColor: alpha(Colors.light.tint, "16"),
    borderColor: alpha(Colors.light.tint, "2A"),
  },
  originLabel: {
    color: Colors.light.text,
    fontSize: 16,
  },
  zoomControlsWrap: {
    position: "absolute",
    left: 18,
    bottom: 164,
    zIndex: 25,
    borderRadius: 999,
    overflow: "hidden",
  },
  zoomControlsWrapBottom: {
    position: "absolute",
    left: 18,
    bottom: 104,
    zIndex: 25,
    borderRadius: 999,
    overflow: "hidden",
  },
  zoomButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  centerButtonWrap: {
    position: "absolute",
    right: 18,
    bottom: 104,
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
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  centerButtonText: {
    fontFamily: "OutfitExtraBold",
    fontSize: 13,
    color: Colors.light.text,
  },
});
