import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import Svg, { Circle as SvgCircle, Defs, LinearGradient as SvgLinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from "react-native-svg";
import {
  Activity, Award, Briefcase, ChevronLeft, ChevronRight, Crown, Eye,
  Flame, Hammer, Heart, Lightbulb, Lock, MoonStar, PenTool,
  Sparkles, Star, Trophy, Wind, Zap,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import {
  Challenge, DOMAIN_COLOR, DOMAIN_LABEL, SKILL_NODES, TREE_LEVELS,
  getPrestigeRank, getUserLevel, getXpForCurrentLevel, getXpForNextLevel,
} from "@/mocks/mvp-data";
import { useAppState, OnboardingAnswers } from "@/state/app-state";
import { trpc } from "@/lib/trpc";
import { analytics } from "@/utils/analytics";
import { ANALYTICS_EVENTS } from "@/utils/event-types";
import { OnboardingScreens } from "@/components/OnboardingScreens";
import { NodePanel } from "@/components/NodePanel";
import { PrestigeModal } from "@/components/PrestigeModal";
import { TreeAvatar, type AvatarActivity } from "@/components/TreeAvatar";
import { getAvatarForRank } from "@/utils/avatar-presets";

type IconComp = React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
type TreePoint = { x: number; y: number };
type DomainId = "mind" | "body" | "craft";
type SkillNodeItem = (typeof SKILL_NODES)[0];

const ICON_MAP: Record<string, IconComp> = {
  Heart, Wind, Activity, Eye, Flame, Lightbulb, Sparkles,
  Hammer, Zap, Award, Trophy, Star, MoonStar, Briefcase, PenTool, Crown,
};

const TREE_TOP_PADDING = 280;
const LEVEL_SPACING = 320;
const ORIGIN_BOTTOM_PADDING = 280;
const ORIGIN_SIZE = 120;
const NODE_SIZE = 108;
const NODE_HEIGHT = Math.round(NODE_SIZE * 1.35);
const HEX_TIP_FRACTION = 0.25;
const NODE_GLOW_SIZE = 172;
const HEADER_HEIGHT = 76;
const TAB_BAR_OFFSET = 96;
const MAP_BOTTOM_PADDING = 200;
const LINE_GLOW_WIDTH = 18;
const LINE_CORE_WIDTH = 7;
const LABEL_PILL_WIDTH = 128;
const APP_BACKGROUND = Colors.light.background;
const GRID_COLOR = "rgba(49,92,255,0.11)";
const ENERGY_SIZE = 20;
const NEON_CYAN = Colors.light.tint;
const SCROLL_SETTLE_DELAY_MS = 120;
const ONBOARDING_GENERATION_TIMEOUT_MS = 15_000;

function alpha(hexColor: string, value: string): string { return `${hexColor}${value}`; }
function clamp(value: number, min: number, max: number): number { return Math.min(Math.max(value, min), max); }

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Tree generation exceeded ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

/** Vertical hexagon points — pointed top/bottom, flat left/right edges. */
function hexPoints(w: number, h: number, tipFraction: number = HEX_TIP_FRACTION, offsetX = 0, offsetY = 0): string {
  const tip1 = h * tipFraction;
  const tip2 = h * (1 - tipFraction);
  return [
    [w / 2, 0], [w, tip1], [w, tip2], [w / 2, h], [0, tip2], [0, tip1],
  ].map(([x, y]) => `${x + offsetX},${y + offsetY}`).join(" ");
}

const COLUMN_DOMAINS: DomainId[] = ["mind", "body", "craft"];
const COLUMN_XFRAC: Record<DomainId, number> = { mind: 0.2, body: 0.5, craft: 0.8 };

function findNodeInColumn(column: DomainId, level: number): SkillNodeItem | undefined {
  return SKILL_NODES.find((n) => n.domainId === column && n.levelNumber === level);
}

function GridBackground({ width, height }: { width: number; height: number }) {
  const gridSize = 48;
  const cols = Math.ceil(width / gridSize);
  const rows = Math.ceil(height / gridSize);
  const lines: React.ReactNode[] = [];
  for (let i = 0; i <= cols; i++) {
    const x = i * gridSize;
    lines.push(<Path key={`v-${i}`} d={`M ${x} 0 L ${x} ${height}`} stroke={GRID_COLOR} strokeWidth={0.5} fill="none" />);
  }
  for (let j = 0; j <= rows; j++) {
    const y = j * gridSize;
    lines.push(<Path key={`h-${j}`} d={`M 0 ${y} L ${width} ${y}`} stroke={GRID_COLOR} strokeWidth={0.5} fill="none" />);
  }
  for (let i = 0; i <= cols; i += 2) {
    for (let j = 0; j <= rows; j += 2) {
      lines.push(<SvgCircle key={`dot-${i}-${j}`} cx={i * gridSize} cy={j * gridSize} r={1.6} fill="rgba(255,214,10,0.22)" />);
    }
  }
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {lines}
    </Svg>
  );
}

function ScanlineOverlay({ width, height }: { width: number; height: number }) {
  return (
    <View pointerEvents="none" style={[scanlineStyles.overlay, { width, height }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFillObject}>
        {Array.from({ length: Math.ceil(height / 3) }).map((_, i) => (
          <Rect key={i} x={0} y={i * 3} width={width} height={1} fill="rgba(49,92,255,0.022)" />
        ))}
      </Svg>
    </View>
  );
}

function ProgressRing({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.min(completed / total, 1) : 0;
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const filled = pct * circumference;
  return (
    <View style={ringStyles.wrap}>
      <BlurView tint="dark" intensity={70} style={ringStyles.blur}>
        <Svg width={68} height={68}>
          <SvgCircle cx={34} cy={34} r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth={4} fill="none" />
          <SvgCircle cx={34} cy={34} r={radius} stroke={NEON_CYAN} strokeWidth={4} fill="none"
            strokeDasharray={[filled, circumference - filled]}
            strokeDashoffset={circumference / 4} strokeLinecap="round" />
        </Svg>
        <View style={ringStyles.inner}>
          <Text style={ringStyles.pct}>{Math.round(pct * 100)}%</Text>
        </View>
      </BlurView>
    </View>
  );
}

function GlowLayers({ color, complete, focused }: { color: string; complete: boolean; focused: boolean }) {
  return (
    <>
      <View pointerEvents="none" style={[styles.glowOuter, { backgroundColor: alpha(color, focused ? "22" : complete ? "16" : "0D") }]} />
      <View pointerEvents="none" style={[styles.glowMid, { backgroundColor: alpha(color, focused ? "28" : complete ? "1E" : "12") }]} />
      <View pointerEvents="none" style={[styles.glowInner, { borderColor: alpha(color, focused ? "60" : complete ? "44" : "22") }]} />
    </>
  );
}

function NodeBubble({ node, point, unlocked, complete, hasProgress, focused, onPress }: {
  node: SkillNodeItem; point: TreePoint; unlocked: boolean; complete: boolean;
  hasProgress: boolean; focused: boolean; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const color = DOMAIN_COLOR[node.domainId];
  const Icon = ICON_MAP[node.icon];
  const fillId = `node-shade-${node.id}`;
  const handlePressIn = useCallback(() => {
    Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, tension: 300, friction: 10 }).start();
  }, [scale]);
  const handlePressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 7 }).start();
  }, [scale]);
  return (
    <>
      <View style={[styles.nodeWrap, { left: point.x - NODE_GLOW_SIZE / 2, top: point.y - NODE_GLOW_SIZE / 2 }]}>
        {unlocked ? <GlowLayers color={color} complete={complete} focused={focused} /> : null}
        {focused ? <View pointerEvents="none" style={[styles.focusRing, { borderColor: unlocked ? alpha(color, "60") : alpha(Colors.light.error, "80") }]} /> : null}
        <Animated.View style={{ transform: [{ scale: focused ? Animated.multiply(scale, 1.06) : scale }] }}>
          <Pressable testID={`node-${node.id}`} onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}
            style={[styles.nodeCore, {
              width: NODE_SIZE, height: NODE_HEIGHT,
              opacity: unlocked ? 1 : 0.5,
              shadowColor: unlocked ? color : "#000",
              shadowOpacity: focused ? 0.45 : unlocked ? 0.25 : 0.1,
              shadowRadius: focused ? 28 : 18,
              shadowOffset: { width: 0, height: 0 },
              elevation: focused ? 20 : 12,
            }]}>
            <Svg width={NODE_SIZE} height={NODE_HEIGHT} style={StyleSheet.absoluteFillObject} pointerEvents="none">
              <Defs>
                <SvgLinearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={unlocked ? color : "#263052"} stopOpacity={unlocked ? (focused ? 0.3 : complete ? 0.2 : 0.14) : 0.13} />
                  <Stop offset="48%" stopColor={APP_BACKGROUND} stopOpacity={0.94} />
                  <Stop offset="100%" stopColor={unlocked ? color : "#11162E"} stopOpacity={unlocked ? (focused ? 0.18 : 0.09) : 0.08} />
                </SvgLinearGradient>
              </Defs>
              <Polygon
                points={hexPoints(NODE_SIZE, NODE_HEIGHT)}
                fill={`url(#${fillId})`}
                stroke={unlocked ? focused ? color : alpha(color, complete ? "D0" : "80") : "rgba(255,255,255,0.06)"}
                strokeWidth={2}
                strokeLinejoin="round"
              />
              <Polygon
                points={hexPoints(NODE_SIZE - 16, NODE_HEIGHT - 16, HEX_TIP_FRACTION, 8, 8)}
                fill="none"
                stroke={unlocked ? alpha(color, focused ? "4A" : complete ? "38" : "20") : "rgba(255,255,255,0.04)"}
                strokeWidth={1}
                strokeLinejoin="round"
              />
            </Svg>
            {unlocked && Icon ? <Icon size={34} color={complete ? color : alpha(color, "F0")} strokeWidth={2.0} /> : <Lock size={20} color="#3A4566" strokeWidth={2.0} />}
            {hasProgress ? <View style={[styles.progressDot, { backgroundColor: color, borderColor: APP_BACKGROUND }]} /> : null}
            {complete ? <View style={[styles.completeBadge, { backgroundColor: color }]}><Text style={styles.completeBadgeCheck}>✓</Text></View> : null}
          </Pressable>
        </Animated.View>
      </View>
      <View pointerEvents="none" style={[styles.labelWrap, { left: point.x - LABEL_PILL_WIDTH / 2, top: point.y + NODE_HEIGHT / 2 + 16, width: LABEL_PILL_WIDTH }]}>
        <View style={[styles.labelConnector, { backgroundColor: unlocked ? alpha(color, "60") : "rgba(255,255,255,0.08)" }]} />
        <View style={[styles.nodeLabelPill, {
          backgroundColor: unlocked ? alpha(color, focused ? "1C" : "12") : "rgba(255,255,255,0.03)",
          borderColor: unlocked ? alpha(color, focused ? "48" : "26") : "rgba(255,255,255,0.06)",
        }]}>
          <Text style={[styles.nodeLabel, { color: unlocked ? focused ? "#FFFFFF" : Colors.light.text : "#5A6688" }]} numberOfLines={1}>{node.title}</Text>
          <Text style={[styles.nodeLevelLabel, { color: unlocked ? alpha(color, "90") : "#3A4566" }]}>L{node.levelNumber} · {DOMAIN_LABEL[node.domainId]}</Text>
        </View>
      </View>
    </>
  );
}

function EnergyDot({
  from,
  to,
  color,
  onFinished,
}: {
  from: TreePoint;
  to: TreePoint;
  color: string;
  onFinished: () => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 900,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onFinished();
      }
    });
    return () => anim.stop();
  }, [from, to, color, onFinished, progress]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, to.x - from.x] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, to.y - from.y] });
  const scale = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 1.3, 1] });
  const opacity = progress.interpolate({ inputRange: [0, 0.08, 0.92, 1], outputRange: [0, 1, 1, 0.6] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: from.x - ENERGY_SIZE / 2,
        top: from.y - ENERGY_SIZE / 2,
        width: ENERGY_SIZE,
        height: ENERGY_SIZE,
        borderRadius: ENERGY_SIZE / 2,
        backgroundColor: color,
        shadowColor: color,
        shadowOpacity: 0.8,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 0 },
        elevation: 20,
        opacity,
        transform: [{ translateX }, { translateY }, { scale }],
        zIndex: 10,
      }}
    >
      <View
        style={{
          position: "absolute",
          top: -ENERGY_SIZE / 2,
          left: -ENERGY_SIZE / 2,
          width: ENERGY_SIZE * 2,
          height: ENERGY_SIZE * 2,
          borderRadius: ENERGY_SIZE,
          backgroundColor: alpha(color, "20"),
        }}
      />
    </Animated.View>
  );
}

export default function TreeScreen() {
  const { width, height } = useWindowDimensions();
  const { state, signIn, completeOnboarding, isNodeComplete, isNodeUnlocked, completedChallenges, totalChallenges, streakCount } = useAppState();

  // Real AI challenge generation via tRPC/Gemini backend
  const generateTreeMutation = trpc.ai.generateTree.useMutation();

  const [nameInput, setNameInput] = useState<string>("");
  const [generatingChallenges, setGeneratingChallenges] = useState<boolean>(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<SkillNodeItem | null>(null);
  const [canvasReady, setCanvasReady] = useState<boolean>(false);

  useEffect(() => { analytics.track(ANALYTICS_EVENTS.ONBOARDING_STARTED); }, []);

  const verticalScrollRef = useRef<ScrollView>(null);
  const horizontalScrollRef = useRef<ScrollView>(null);
  const hasCentered = useRef(false);
  const xpFlashAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const openNodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollOffsetRef = useRef<TreePoint>({ x: 0, y: 0 });
  const verticalSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const horizontalSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [xpGained, setXpGained] = useState<number>(0);
  const [focusedColumn, setFocusedColumn] = useState<DomainId>("body");
  const [focusedLevel, setFocusedLevel] = useState<number>(0);
  const [mapScale] = useState<number>(1);
  const [energyTravel, setEnergyTravel] = useState<{ fromId: string; toId: string; color: string } | null>(null);
  const introAnim = useRef(new Animated.Value(0)).current;
  const hasStartedIntro = useRef(false);

  const flashXP = useCallback((amount: number) => {
    setXpGained(amount);
    xpFlashAnim.setValue(1);
    Animated.timing(xpFlashAnim, { toValue: 0, duration: 1800, useNativeDriver: true }).start();
  }, [xpFlashAnim]);

  const generateOnboardingChallenges = useCallback(async (answers: OnboardingAnswers) => {
    setGeneratingChallenges(true);
    setGenerateError(null);
    try {
      const generatedNodes = await withTimeout(
        generateTreeMutation.mutateAsync({
          mind: answers.mind,
          body: answers.body,
          craft: answers.craft,
        }),
        ONBOARDING_GENERATION_TIMEOUT_MS
      );
      const allGenerated: Record<string, Challenge[]> = {};
      SKILL_NODES.forEach((node) => {
        const gen = generatedNodes?.[node.id as keyof typeof generatedNodes];
        const fixed = node.defaultChallenges.filter((c) => c.isFixed);
        const replaceableCount = node.defaultChallenges.length - fixed.length;
        if (gen) {
          const aiGenerated = gen.slice(0, replaceableCount).map((c, i) => ({
            id: `ai-${node.id}-${i}-${Date.now()}`,
            nodeId: node.id,
            title: c.title,
            detail: c.detail,
            xp: c.xp,
            type: "manual" as const,
          }));
          // Fixed challenges (e.g. distraction-free focus sessions) are always
          // preserved and prepended — AI cannot replace or remove them.
          allGenerated[node.id] = [...fixed, ...aiGenerated];
        } else {
          allGenerated[node.id] = node.defaultChallenges;
        }
      });
      analytics.track(ANALYTICS_EVENTS.ONBOARDING_AI_GENERATED);
      completeOnboarding(answers, allGenerated);
    } catch (error) {
      console.error("[onboard] AI failed, using defaults:", error);
      analytics.track(ANALYTICS_EVENTS.ONBOARDING_AI_FAILED);
      // Graceful fallback so the app still works without network
      const fallback: Record<string, Challenge[]> = {};
      SKILL_NODES.forEach((node) => { fallback[node.id] = node.defaultChallenges; });
      completeOnboarding(answers, fallback);
    } finally {
      setGeneratingChallenges(false);
    }
  }, [completeOnboarding, generateTreeMutation]);

  const currentLevel = getUserLevel(state.xp);
  const xpCurrent = getXpForCurrentLevel(currentLevel);
  const xpNext = getXpForNextLevel(currentLevel);
  const xpProgress = xpNext > xpCurrent ? (state.xp - xpCurrent) / (xpNext - xpCurrent) : 1;
  const currentPrestigeRank = getPrestigeRank(state.prestigeCount);
  const maxTreeLevel = TREE_LEVELS[TREE_LEVELS.length - 1]?.number ?? 1;

  const baseCanvasWidth = Math.max(width * 2.6, 1200);
  const baseOriginY = TREE_TOP_PADDING + maxTreeLevel * LEVEL_SPACING;
  const baseCanvasHeight = baseOriginY + ORIGIN_BOTTOM_PADDING;
  const canvasWidth = baseCanvasWidth * mapScale;
  const originY = baseOriginY * mapScale;
  const canvasHeight = baseCanvasHeight * mapScale;
  const originPoint = useMemo<TreePoint>(() => ({ x: canvasWidth * 0.5, y: originY }), [canvasWidth, originY]);

  const focusPoint = useCallback((point: TreePoint, animated: boolean) => {
    const visibleHeight = Math.max(height - HEADER_HEIGHT - TAB_BAR_OFFSET, 240);
    const maxX = Math.max(canvasWidth - width, 0);
    const maxY = Math.max(HEADER_HEIGHT + 70 + canvasHeight + MAP_BOTTOM_PADDING - height, 0);
    const x = clamp(point.x - width / 2, 0, maxX);
    // paddingTop on the vertical ScrollView is already HEADER_HEIGHT + 70, which cancels
    // out against the header offset here — adding +70 again double-counts it and pushes
    // every centered view further down than intended (node ends up above center).
    const y = clamp(point.y - visibleHeight / 2, 0, maxY);
    horizontalScrollRef.current?.scrollTo({ x, y: 0, animated });
    verticalScrollRef.current?.scrollTo({ x: 0, y, animated });
    scrollOffsetRef.current = { x, y };
  }, [canvasHeight, canvasWidth, height, width]);

  const nodePositions = useMemo<Record<string, TreePoint>>(() => {
    const positions: Record<string, TreePoint> = {};
    SKILL_NODES.forEach((node) => {
      positions[node.id] = {
        x: canvasWidth * node.xFrac,
        y: originY - node.levelNumber * LEVEL_SPACING * mapScale,
      };
    });
    return positions;
  }, [canvasWidth, mapScale, originY]);

  const connections = useMemo(() => {
    return SKILL_NODES.flatMap((node) => {
      const parents = node.parentIds.length > 0 ? node.parentIds : ["origin"];
      return parents.map((parentId) => ({ parentId, nodeId: node.id }));
    });
  }, []);

  const columnSnapOffsets = useMemo(() => {
    const maxX = Math.max(canvasWidth - width, 0);
    return COLUMN_DOMAINS.map((col) => clamp(canvasWidth * COLUMN_XFRAC[col] - width / 2, 0, maxX)).sort((a, b) => a - b);
  }, [canvasWidth, width]);

  // Locked while a programmatic scroll (arrow press / node tap) is in flight so the
  // native onMomentumScrollEnd handler doesn't immediately re-detect and override it.
  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const focusedNodeId = useMemo<string>(() => {
    if (focusedLevel === 0) return "origin";
    const node = findNodeInColumn(focusedColumn, focusedLevel);
    return node?.id ?? "origin";
  }, [focusedColumn, focusedLevel]);

  const focusedNode = useMemo(
    () => focusedNodeId === "origin" ? undefined : SKILL_NODES.find((node) => node.id === focusedNodeId),
    [focusedNodeId]
  );
  const avatarTarget = focusedNode ? (nodePositions[focusedNode.id] ?? originPoint) : originPoint;
  const avatarUnlocked = !focusedNode || isNodeUnlocked(focusedNode.id);
  const avatarFallback = useMemo<TreePoint>(() => {
    if (avatarUnlocked) return avatarTarget;
    for (let level = focusedLevel - 1; level >= 1; level -= 1) {
      const candidate = findNodeInColumn(focusedColumn, level);
      if (candidate && isNodeUnlocked(candidate.id)) return nodePositions[candidate.id] ?? originPoint;
    }
    return originPoint;
  }, [avatarTarget, avatarUnlocked, focusedColumn, focusedLevel, isNodeUnlocked, nodePositions, originPoint]);
  const avatarActivity: AvatarActivity = !focusedNode
    ? "ready"
    : focusedNode.domainId === "mind"
      ? "meditate"
      : focusedNode.domainId === "body"
        ? "lift"
        : "code";
  const avatarColor = focusedNode ? DOMAIN_COLOR[focusedNode.domainId] : NEON_CYAN;
  const avatarConfig = state.onboardingAnswers?.avatar ?? getAvatarForRank(state.prestigeCount);

  const focusColumnLevel = useCallback((col: DomainId, level: number, animated: boolean) => {
    if (animated) {
      isProgrammaticScrollRef.current = true;
      if (programmaticScrollTimeoutRef.current) clearTimeout(programmaticScrollTimeoutRef.current);
      // Native scroll events may start synchronously, so take the lock before scrollTo.
      programmaticScrollTimeoutRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 550);
    }

    setFocusedColumn(col);
    setFocusedLevel(level);
    const node = level === 0 ? undefined : findNodeInColumn(col, level);
    const point = level === 0 ? originPoint : node ? nodePositions[node.id] : undefined;
    if (point) focusPoint(point, animated);
  }, [focusPoint, nodePositions, originPoint]);

  const focusNodeId = useCallback((nodeId: string, animated: boolean) => {
    if (nodeId === "origin") { focusColumnLevel("body", 0, animated); return; }
    const node = SKILL_NODES.find((n) => n.id === nodeId);
    if (node) focusColumnLevel(node.domainId, node.levelNumber, animated);
  }, [focusColumnLevel]);

  const navigateColumn = useCallback((direction: 1 | -1) => {
    const idx = COLUMN_DOMAINS.indexOf(focusedColumn);
    const nextIdx = clamp(idx + direction, 0, COLUMN_DOMAINS.length - 1);
    if (nextIdx === idx) return;
    Haptics.selectionAsync();
    const nextCol = COLUMN_DOMAINS[nextIdx];
    const level = Math.max(1, focusedLevel);
    setFocusedColumn(nextCol);
    setFocusedLevel(level);

    // Scroll to the column's exact native snap-grid offset — never an arbitrary node
    // pixel position — so the ScrollView can't disagree with what we just set.
    isProgrammaticScrollRef.current = true;
    if (programmaticScrollTimeoutRef.current) clearTimeout(programmaticScrollTimeoutRef.current);
    horizontalScrollRef.current?.scrollTo({ x: columnSnapOffsets[nextIdx], y: 0, animated: true });
    const node = findNodeInColumn(nextCol, level);
    if (node) {
      const point = nodePositions[node.id];
      const visibleHeight = Math.max(height - HEADER_HEIGHT - TAB_BAR_OFFSET, 240);
      const maxY = Math.max(HEADER_HEIGHT + 70 + canvasHeight + MAP_BOTTOM_PADDING - height, 0);
      const y = clamp(point.y - visibleHeight / 2, 0, maxY);
      verticalScrollRef.current?.scrollTo({ x: 0, y, animated: true });
    }
    programmaticScrollTimeoutRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 550);
  }, [focusedColumn, focusedLevel, columnSnapOffsets, nodePositions, height, canvasHeight]);

  const onNodeComplete = useCallback((nodeId: string) => {
    const node = SKILL_NODES.find((n) => n.id === nodeId);
    if (!node) return;
    const child = findNodeInColumn(node.domainId, node.levelNumber + 1);
    if (child) {
      setEnergyTravel({ fromId: nodeId, toId: child.id, color: DOMAIN_COLOR[node.domainId] });
    }
  }, [setEnergyTravel]);

  const settleVerticalOffset = useCallback((y: number) => {
    scrollOffsetRef.current = { ...scrollOffsetRef.current, y };
    if (isProgrammaticScrollRef.current) return;

    // This is the exact inverse of focusPoint's y offset. Keeping both directions
    // symmetrical prevents focus from jumping a level when scrolling settles.
    const visibleHeight = Math.max(height - HEADER_HEIGHT - TAB_BAR_OFFSET, 240);
    const centerYCanvas = y + visibleHeight / 2;

    let bestLevel = 0;
    let bestDist = Infinity;
    for (let lvl = 0; lvl <= maxTreeLevel; lvl++) {
      const nodeY = lvl === 0 ? originY : originY - lvl * LEVEL_SPACING * mapScale;
      const d = Math.abs(centerYCanvas - nodeY);
      if (d < bestDist) { bestDist = d; bestLevel = lvl; }
    }
    if (bestLevel !== focusedLevel) {
      Haptics.selectionAsync();
      setFocusedLevel(bestLevel);
    }
  }, [height, maxTreeLevel, originY, mapScale, focusedLevel]);

  const settleHorizontalOffset = useCallback((x: number) => {
    scrollOffsetRef.current = { ...scrollOffsetRef.current, x };
    if (isProgrammaticScrollRef.current) return;
    const centerX = x + width / 2;
    let best: DomainId = "body";
    let bestDist = Infinity;
    for (const col of COLUMN_DOMAINS) {
      const d = Math.abs(centerX - canvasWidth * COLUMN_XFRAC[col]);
      if (d < bestDist) { bestDist = d; best = col; }
    }
    if (best !== focusedColumn) {
      setFocusedColumn(best);
      if (focusedLevel === 0) setFocusedLevel(1);
    }
  }, [canvasWidth, width, focusedColumn, focusedLevel]);

  const handleUserScrollBegin = useCallback(() => {
    // A finger drag takes ownership from any in-flight arrow/node camera move.
    isProgrammaticScrollRef.current = false;
    if (programmaticScrollTimeoutRef.current) {
      clearTimeout(programmaticScrollTimeoutRef.current);
      programmaticScrollTimeoutRef.current = null;
    }
    if (verticalSettleTimeoutRef.current) {
      clearTimeout(verticalSettleTimeoutRef.current);
      verticalSettleTimeoutRef.current = null;
    }
    if (horizontalSettleTimeoutRef.current) {
      clearTimeout(horizontalSettleTimeoutRef.current);
      horizontalSettleTimeoutRef.current = null;
    }
  }, []);

  const handleVerticalScrollEndDrag = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    scrollOffsetRef.current = { ...scrollOffsetRef.current, y };
    if (verticalSettleTimeoutRef.current) clearTimeout(verticalSettleTimeoutRef.current);
    verticalSettleTimeoutRef.current = setTimeout(() => {
      verticalSettleTimeoutRef.current = null;
      settleVerticalOffset(y);
    }, SCROLL_SETTLE_DELAY_MS);
  }, [settleVerticalOffset]);

  const handleVerticalMomentumBegin = useCallback(() => {
    if (verticalSettleTimeoutRef.current) {
      clearTimeout(verticalSettleTimeoutRef.current);
      verticalSettleTimeoutRef.current = null;
    }
  }, []);

  const handleVerticalMomentumEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (verticalSettleTimeoutRef.current) {
      clearTimeout(verticalSettleTimeoutRef.current);
      verticalSettleTimeoutRef.current = null;
    }
    settleVerticalOffset(event.nativeEvent.contentOffset.y);
  }, [settleVerticalOffset]);

  const handleHorizontalScrollEndDrag = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    scrollOffsetRef.current = { ...scrollOffsetRef.current, x };
    if (horizontalSettleTimeoutRef.current) clearTimeout(horizontalSettleTimeoutRef.current);
    horizontalSettleTimeoutRef.current = setTimeout(() => {
      horizontalSettleTimeoutRef.current = null;
      settleHorizontalOffset(x);
    }, SCROLL_SETTLE_DELAY_MS);
  }, [settleHorizontalOffset]);

  const handleHorizontalMomentumBegin = useCallback(() => {
    if (horizontalSettleTimeoutRef.current) {
      clearTimeout(horizontalSettleTimeoutRef.current);
      horizontalSettleTimeoutRef.current = null;
    }
  }, []);

  const handleHorizontalMomentumEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (horizontalSettleTimeoutRef.current) {
      clearTimeout(horizontalSettleTimeoutRef.current);
      horizontalSettleTimeoutRef.current = null;
    }
    settleHorizontalOffset(event.nativeEvent.contentOffset.x);
  }, [settleHorizontalOffset]);

  const handleCanvasReady = useCallback(() => {
    if (!hasCentered.current && state.onboardingComplete) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          focusColumnLevel("body", 0, false);
          hasCentered.current = true;
          setCanvasReady(true);
        });
      });
    }
  }, [focusColumnLevel, state.onboardingComplete]);

  useEffect(() => {
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: 2500, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0, duration: 2500, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => {
      pulse.stop();
      if (openNodeTimeoutRef.current) clearTimeout(openNodeTimeoutRef.current);
      if (programmaticScrollTimeoutRef.current) clearTimeout(programmaticScrollTimeoutRef.current);
      if (verticalSettleTimeoutRef.current) clearTimeout(verticalSettleTimeoutRef.current);
      if (horizontalSettleTimeoutRef.current) clearTimeout(horizontalSettleTimeoutRef.current);
    };
  }, [pulseAnim]);

  // Intro formation animation — tree coalesces from a compact cluster into the clean layout
  useEffect(() => {
    if (!canvasReady || hasStartedIntro.current) return;
    hasStartedIntro.current = true;
    introAnim.setValue(0);
    Animated.sequence([
      Animated.delay(200),
      Animated.spring(introAnim, { toValue: 1, tension: 58, friction: 10, useNativeDriver: true }),
    ]).start();
  }, [canvasReady, introAnim]);

  // Auth screen
  if (!state.isAuthed) {
    return (
      <View style={styles.shell}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.authBgGrid} pointerEvents="none" />
          <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.authHero}>
              <View style={styles.authBrandRow}>
                <View style={styles.authBrandDot} />
                <Text style={styles.brand}>SKILLTREE</Text>
              </View>
              <Text style={styles.authTitle}>READY PLAYER{"\n"}ONE?</Text>
              <Text style={styles.authSub}>Name your player, choose your quests, and climb a skill tree built around real-life progress.</Text>
            </View>
            <View style={styles.proUpsellCard}>
              <View style={styles.proUpsellHeader}>
                <View style={styles.proUpsellCrownWrap}><Crown size={18} color="#FFD700" strokeWidth={2.0} /></View>
                <View style={styles.proUpsellHeaderText}>
                  <Text style={styles.proUpsellTitle}>Go Pro</Text>
                  <Text style={styles.proUpsellSub}>Start your journey with an edge</Text>
                </View>
                <View style={styles.proTag}><Text style={styles.proTagText}>PRO</Text></View>
              </View>
              <View style={styles.proUpsellPerks}>
                {[{ icon: Zap, text: "1.5× XP on every challenge" }, { icon: Flame, text: "Ad-free progression" }, { icon: Sparkles, text: "Priority AI personalization" }].map(({ icon: Icon, text }) => (
                  <View key={text} style={styles.proPerkRow}>
                    <View style={styles.proPerkIconWrap}><Icon size={12} color={NEON_CYAN} strokeWidth={2.2} /></View>
                    <Text style={styles.proPerkText}>{text}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.proUpsellPriceRow}>
                <Text style={styles.proUpsellPrice}>$5.99</Text>
                <Text style={styles.proUpsellPricePeriod}>/month · cancel anytime</Text>
              </View>
            </View>
            <BlurView tint="dark" intensity={75} style={styles.authCard}>
              <Text style={styles.authCardLabel}>WHAT SHOULD WE CALL YOU?</Text>
              <TextInput style={styles.authInput} value={nameInput} onChangeText={setNameInput}
                placeholder="Enter your name" placeholderTextColor="#4A5680" autoCapitalize="words" testID="auth-name" />
              <TouchableOpacity style={[styles.primaryBtn, !nameInput.trim() && styles.primaryBtnDisabled]}
                onPress={() => {
                  Keyboard.dismiss();
                  signIn(nameInput.trim() || "Adventurer");
                }} disabled={!nameInput.trim()} testID="auth-continue">
                <Text style={styles.primaryBtnText}>Begin Journey</Text>
                <ChevronRight size={18} color="#050811" strokeWidth={2.5} />
              </TouchableOpacity>
            </BlurView>
            <Text style={styles.authFooter}>SECURE · PRIVATE · YOUR DATA STAYS ON DEVICE</Text>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  if (!state.onboardingComplete) {
    return <OnboardingScreens onComplete={generateOnboardingChallenges} isGenerating={generatingChallenges} generateError={generateError} />;
  }

  // Tree screen
  return (
    <View style={styles.shell}>
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.ambientOrb, { opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.5] }) }]} pointerEvents="none" />

        <View style={styles.headerWrap}>
          <BlurView tint="dark" intensity={80} style={styles.headerBlur}>
            <View style={styles.headerLeft}>
              <View style={styles.headerBrandRow}>
                <View style={styles.headerBrandDot} />
                <Text style={styles.brand}>SKILLTREE</Text>
              </View>
              <Text style={styles.greeting}>{state.displayName || "Adventurer"}</Text>
            </View>
            <View style={styles.headerRight}>
              <View style={styles.headerStats}>
                <Text style={styles.headerStatValue}>LV{currentLevel}</Text>
                <Text style={styles.headerStatLabel}>LEVEL</Text>
              </View>
              <View style={styles.headerDivider} />
              <View style={[
                styles.streakPill,
                { borderColor: streakCount > 0 ? alpha("#FF6A4D", "40") : "rgba(255,255,255,0.06)",
                  backgroundColor: streakCount > 0 ? alpha("#FF6A4D", "12") : "transparent" },
              ]}>
                <Flame size={12} color={streakCount > 0 ? "#FF6A4D" : "#4A5680"} strokeWidth={2.2} />
                <Text style={[styles.streakPillText, { color: streakCount > 0 ? "#FF6A4D" : "#4A5680" }]}>
                  {streakCount}
                </Text>
              </View>
              <View style={styles.headerStats}>
                <Text style={styles.headerStatValue}>{completedChallenges}<Text style={styles.headerStatMuted}>/{totalChallenges}</Text></Text>
                <Text style={styles.headerStatLabel}>DONE</Text>
              </View>
              <ProgressRing completed={completedChallenges} total={totalChallenges} />
            </View>
          </BlurView>
          <View style={styles.xpBarContainer}>
            <View style={styles.xpBarTrack}>
              <View style={[styles.xpBarFill, { width: `${Math.min(xpProgress * 100, 100)}%` as `${number}%` }]} />
            </View>
            <View style={styles.xpBarMetaRow}>
              <Text style={styles.xpBarLabel}>{Math.max(0, state.xp - xpCurrent)} / {Math.max(0, xpNext - xpCurrent)} XP</Text>
              <View style={[styles.rankPill, { borderColor: alpha(currentPrestigeRank.color, "38"), backgroundColor: alpha(currentPrestigeRank.color, "12") }]}>
                <Trophy size={10} color={currentPrestigeRank.color} strokeWidth={2.2} />
                <Text style={[styles.rankPillText, { color: currentPrestigeRank.color }]}>{currentPrestigeRank.name}</Text>
              </View>
            </View>
          </View>
        </View>

        <Animated.View style={[styles.xpFlash, { opacity: xpFlashAnim }]} pointerEvents="none">
          <BlurView tint="dark" intensity={70} style={styles.xpFlashBubble}>
            <Zap size={14} color={NEON_CYAN} strokeWidth={2.5} />
            <Text style={styles.xpFlashText}>+{xpGained} XP</Text>
          </BlurView>
        </Animated.View>

        <ScrollView ref={verticalScrollRef} style={styles.verticalScroll}
          contentContainerStyle={{ paddingTop: HEADER_HEIGHT + 70, paddingBottom: MAP_BOTTOM_PADDING }}
          showsVerticalScrollIndicator={false} scrollEventThrottle={16}
          directionalLockEnabled={true} nestedScrollEnabled={true} decelerationRate="fast"
          onScrollBeginDrag={handleUserScrollBegin}
          onScrollEndDrag={handleVerticalScrollEndDrag}
          onMomentumScrollBegin={handleVerticalMomentumBegin}
          onMomentumScrollEnd={handleVerticalMomentumEnd}
          onContentSizeChange={handleCanvasReady} testID="tree-vertical-scroll">
          <ScrollView ref={horizontalScrollRef} horizontal={true} bounces={false} pagingEnabled={false}
            snapToOffsets={columnSnapOffsets} decelerationRate="fast" directionalLockEnabled={true}
            nestedScrollEnabled={true} showsHorizontalScrollIndicator={false}
            onScrollBeginDrag={handleUserScrollBegin}
            onScrollEndDrag={handleHorizontalScrollEndDrag}
            onMomentumScrollBegin={handleHorizontalMomentumBegin}
            onMomentumScrollEnd={handleHorizontalMomentumEnd}
            contentContainerStyle={{ width: canvasWidth }} testID="tree-horizontal-scroll">
            <View style={{ width: canvasWidth, height: canvasHeight }}>
              <Animated.View
                style={[
                  { width: canvasWidth, height: canvasHeight },
                  {
                    opacity: introAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.8, 1] }),
                    transform: [
                      { translateX: canvasWidth / 2 },
                      { translateY: canvasHeight / 2 },
                      { scale: introAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
                      { translateX: -canvasWidth / 2 },
                      { translateY: -canvasHeight / 2 },
                    ],
                  },
                  { overflow: "visible" },
                ]}
              >
              <GridBackground width={canvasWidth} height={canvasHeight} />
              <Svg width={canvasWidth} height={canvasHeight} style={StyleSheet.absoluteFillObject} pointerEvents="none">
                <Defs>
                  {(["mind", "body", "craft"] as const).map((domain) => {
                    const color = DOMAIN_COLOR[domain];
                    return (
                      <SvgLinearGradient key={`grad-${domain}`} id={`line-grad-${domain}`} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor={color} stopOpacity={0.9} />
                        <Stop offset="100%" stopColor={color} stopOpacity={0.5} />
                      </SvgLinearGradient>
                    );
                  })}
                  <RadialGradient id="origin-radial" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor={NEON_CYAN} stopOpacity={0.15} />
                    <Stop offset="100%" stopColor={NEON_CYAN} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <SvgCircle cx={originPoint.x} cy={originPoint.y} r={180} fill="url(#origin-radial)" />
                {connections.map(({ parentId, nodeId }) => {
                  const parentPoint = parentId === "origin" ? originPoint : nodePositions[parentId];
                  const childPoint = nodePositions[nodeId];
                  const childNode = SKILL_NODES.find((node) => node.id === nodeId);
                  if (!parentPoint || !childPoint || !childNode) return null;
                  const connectorActive = isNodeUnlocked(childNode.id) || isNodeComplete(parentId);
                  const color = DOMAIN_COLOR[childNode.domainId];
                  const isFocused = focusedNodeId === nodeId;
                  const midY = (parentPoint.y + childPoint.y) / 2;
                  const path = `M ${parentPoint.x} ${parentPoint.y} C ${parentPoint.x} ${midY} ${childPoint.x} ${midY} ${childPoint.x} ${childPoint.y}`;
                  return (
                    <React.Fragment key={`${parentId}-${nodeId}`}>
                      {connectorActive ? <Path d={path} stroke={alpha(color, isFocused ? "30" : "14")} strokeWidth={isFocused ? LINE_GLOW_WIDTH + 6 : LINE_GLOW_WIDTH} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
                      <Path d={path} stroke={connectorActive ? isFocused ? color : alpha(color, "88") : "rgba(255,255,255,0.08)"} strokeWidth={connectorActive ? isFocused ? LINE_CORE_WIDTH + 2 : LINE_CORE_WIDTH : 4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      {connectorActive ? (
                        <>
                          <SvgCircle cx={parentPoint.x} cy={parentPoint.y} r={5} fill={alpha(color, "60")} />
                          <SvgCircle cx={childPoint.x} cy={childPoint.y} r={isFocused ? 7 : 5} fill={alpha(color, isFocused ? "90" : "60")} />
                        </>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </Svg>

              <View style={[styles.originWrap, { left: originPoint.x - NODE_GLOW_SIZE / 2, top: originPoint.y - NODE_GLOW_SIZE / 2 }]} pointerEvents="none">
                <GlowLayers color={NEON_CYAN} complete focused={focusedNodeId === "origin"} />
                <View style={styles.originNode}>
                  <View style={styles.originNodeInner}><Zap size={36} color={NEON_CYAN} strokeWidth={2.0} /></View>
                </View>
              </View>
              <View pointerEvents="none" style={[styles.labelWrap, { left: originPoint.x - LABEL_PILL_WIDTH / 2, top: originPoint.y + ORIGIN_SIZE / 2 + 16, width: LABEL_PILL_WIDTH }]}>
                <View style={[styles.labelConnector, { backgroundColor: alpha(NEON_CYAN, "70") }]} />
                <View style={[styles.nodeLabelPill, styles.originLabelPill]}>
                  <Text style={[styles.nodeLabel, styles.originLabel]}>Origin</Text>
                  <Text style={[styles.nodeLevelLabel, { color: alpha(NEON_CYAN, "90") }]}>START HERE</Text>
                </View>
              </View>

              {SKILL_NODES.map((node) => {
                const point = nodePositions[node.id];
                const unlocked = isNodeUnlocked(node.id);
                const complete = isNodeComplete(node.id);
                const challenges = (state.aiChallenges[node.id] ?? []).length > 0 ? state.aiChallenges[node.id] : node.defaultChallenges;
                const completedCount = challenges.filter((c) => state.challengeProgress[c.id]).length;
                const hasProgress = completedCount > 0 && !complete;
                if (!point) return null;
                return (
                  <NodeBubble key={node.id} node={node} point={point} unlocked={unlocked} complete={complete}
                    hasProgress={hasProgress} focused={focusedNodeId === node.id}
                    onPress={async () => {
                      if (!unlocked) {
                        focusNodeId(node.id, true);
                        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        return;
                      }
                      if (openNodeTimeoutRef.current) clearTimeout(openNodeTimeoutRef.current);
                      await Haptics.selectionAsync();
                      focusNodeId(node.id, true);
                      openNodeTimeoutRef.current = setTimeout(() => { setSelectedNode(node); }, 220);
                    }} />
                );
              })}
              <TreeAvatar
                avatar={avatarConfig}
                target={avatarTarget}
                fallback={avatarFallback}
                unlocked={avatarUnlocked}
                movementKey={focusedNodeId}
                activity={avatarActivity}
                color={avatarColor}
              />
              </Animated.View>
              {energyTravel ? (
                <EnergyDot
                  from={energyTravel.fromId === "origin" ? originPoint : (nodePositions[energyTravel.fromId] ?? originPoint)}
                  to={nodePositions[energyTravel.toId] ?? originPoint}
                  color={energyTravel.color}
                  onFinished={() => setEnergyTravel(null)}
                />
              ) : null}
            </View>
          </ScrollView>
        </ScrollView>

        <ScanlineOverlay width={width} height={height} />

        {canvasReady ? (
          <>
            <Pressable style={styles.navLeftButton} onPress={() => navigateColumn(-1)} testID="nav-left">
              <BlurView tint="dark" intensity={82} style={styles.navButtonBlur}>
                <ChevronLeft size={18} color={NEON_CYAN} strokeWidth={2.6} />
              </BlurView>
            </Pressable>
            <Pressable style={styles.navRightButton} onPress={() => navigateColumn(1)} testID="nav-right">
              <BlurView tint="dark" intensity={82} style={styles.navButtonBlur}>
                <ChevronRight size={18} color={NEON_CYAN} strokeWidth={2.6} />
              </BlurView>
            </Pressable>
          </>
        ) : null}

        {selectedNode ? <NodePanel node={selectedNode} onClose={() => setSelectedNode(null)} iconMap={ICON_MAP} flashXP={flashXP} onNodeComplete={onNodeComplete} /> : null}
        <PrestigeModal />
      </SafeAreaView>
    </View>
  );
}

const scanlineStyles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, left: 0, zIndex: 1 },
});

const ringStyles = StyleSheet.create({
  wrap: { width: 68, height: 68, alignItems: "center", justifyContent: "center" },
  blur: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: Colors.light.surfaceDeep, borderWidth: 2, borderColor: "rgba(49,92,255,0.5)" },
  inner: { position: "absolute", alignItems: "center" },
  pct: { fontSize: 13, fontWeight: "900", color: Colors.light.text },
});

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: APP_BACKGROUND },
  safeArea: { flex: 1 },
  ambientOrb: { position: "absolute", width: 400, height: 400, borderRadius: 200, backgroundColor: "rgba(49,92,255,0.08)", top: -100, right: -100, zIndex: 0 },
  headerWrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, paddingHorizontal: 14, paddingTop: 6 },
  headerBlur: { borderRadius: 18, overflow: "hidden", paddingHorizontal: 18, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(11,16,43,0.9)", borderWidth: 2, borderColor: "rgba(49,92,255,0.42)" },
  headerLeft: { flex: 1 },
  headerBrandRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  headerBrandDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: NEON_CYAN, shadowColor: NEON_CYAN, shadowOpacity: 0.6, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  brand: { fontFamily: "monospace", fontSize: 10, letterSpacing: 3, color: NEON_CYAN, fontWeight: "900", textTransform: "uppercase" },
  greeting: { fontSize: 20, fontWeight: "900", color: Colors.light.text, letterSpacing: -0.5 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerStats: { alignItems: "flex-end", gap: 2 },
  headerStatValue: { fontFamily: "monospace", fontSize: 16, fontWeight: "900", color: Colors.light.text, letterSpacing: -0.3 },
  headerStatMuted: { color: "#5A6B92", fontWeight: "700" },
  headerStatLabel: { fontSize: 8, letterSpacing: 1.5, color: "#4A5680", fontWeight: "700" },
  headerDivider: { width: 2, height: 28, backgroundColor: "rgba(49,92,255,0.32)" },
  streakPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  streakPillText: { fontSize: 13, fontWeight: "900" },
  xpBarContainer: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: "rgba(11,16,43,0.92)", borderWidth: 2, borderColor: "rgba(49,92,255,0.28)", gap: 6 },
  xpBarTrack: { height: 5, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" },
  xpBarFill: { height: "100%", backgroundColor: NEON_CYAN, borderRadius: 999, shadowColor: NEON_CYAN, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  xpBarMetaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  xpBarLabel: { fontSize: 11, color: "#7A8AB0", fontWeight: "700" },
  rankPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  rankPillText: { fontSize: 10, fontWeight: "800" },
  xpFlash: { position: "absolute", top: HEADER_HEIGHT + 60, left: 0, right: 0, alignItems: "center", zIndex: 30 },
  xpFlashBubble: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, overflow: "hidden", backgroundColor: Colors.light.surfaceDeep, borderWidth: 2, borderColor: alpha(NEON_CYAN, "70") },
  xpFlashText: { fontSize: 13, fontWeight: "800", color: NEON_CYAN },
  verticalScroll: { flex: 1, zIndex: 2 },
  horizontalScrollContent: { width: "100%", paddingBottom: 40 },
  originWrap: { position: "absolute", width: NODE_GLOW_SIZE, height: NODE_GLOW_SIZE, alignItems: "center", justifyContent: "center", zIndex: 3 },
  originNode: { width: ORIGIN_SIZE, height: ORIGIN_SIZE, borderRadius: ORIGIN_SIZE / 2, backgroundColor: alpha(NEON_CYAN, "16"), borderWidth: 2.5, borderColor: NEON_CYAN, alignItems: "center", justifyContent: "center", shadowColor: NEON_CYAN, shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 18 },
  originNodeInner: { width: ORIGIN_SIZE - 20, height: ORIGIN_SIZE - 20, borderRadius: (ORIGIN_SIZE - 20) / 2, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: alpha(NEON_CYAN, "20") },
  nodeWrap: { position: "absolute", width: NODE_GLOW_SIZE, height: NODE_GLOW_SIZE, alignItems: "center", justifyContent: "center", zIndex: 4 },
  glowOuter: { position: "absolute", width: NODE_GLOW_SIZE, height: NODE_GLOW_SIZE, borderRadius: NODE_GLOW_SIZE / 2 },
  glowMid: { position: "absolute", width: 128, height: 128, borderRadius: 64 },
  glowInner: { position: "absolute", width: 110, height: 110, borderRadius: 55, borderWidth: 1, backgroundColor: "transparent" },
  focusRing: { position: "absolute", width: NODE_GLOW_SIZE - 10, height: NODE_GLOW_SIZE - 10, borderRadius: (NODE_GLOW_SIZE - 10) / 2, borderWidth: 1.5, borderStyle: "dashed" },
  nodeCore: { alignItems: "center", justifyContent: "center" },
  progressDot: { position: "absolute", width: 14, height: 14, borderRadius: 7, borderWidth: 2, top: 8, right: 8 },
  completeBadge: { position: "absolute", width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 2.5, borderColor: APP_BACKGROUND, top: -2, right: -2 },
  completeBadgeCheck: { fontSize: 11, fontWeight: "900", color: "#000" },
  labelWrap: { position: "absolute", alignItems: "center", zIndex: 5 },
  labelConnector: { width: 2, height: 14, borderRadius: 999, marginBottom: 6 },
  nodeLabelPill: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  nodeLabel: { fontSize: 14, fontWeight: "800", textAlign: "center", lineHeight: 17 },
  nodeLevelLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1, marginTop: 2 },
  originLabelPill: { backgroundColor: alpha(NEON_CYAN, "18"), borderColor: alpha(NEON_CYAN, "30") },
  originLabel: { color: Colors.light.text, fontSize: 15 },
  authBgGrid: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: APP_BACKGROUND, borderWidth: 18, borderColor: "rgba(49,92,255,0.12)" },
  authScroll: { padding: 24, paddingTop: 60, gap: 24, flexGrow: 1 },
  authHero: { gap: 14, marginBottom: 4 },
  authBrandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  authBrandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: NEON_CYAN, shadowColor: NEON_CYAN, shadowOpacity: 0.7, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  authTitle: { fontFamily: "monospace", fontSize: 38, fontWeight: "900", color: Colors.light.text, lineHeight: 45, letterSpacing: -1 },
  authSub: { fontSize: 15, color: "#7A8AB0", lineHeight: 23 },
  proUpsellCard: { borderRadius: 10, padding: 20, gap: 16, borderWidth: 2, borderColor: Colors.light.arcadeBlue, backgroundColor: Colors.light.surfaceDeep },
  proUpsellHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  proUpsellCrownWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,215,0,0.12)", borderWidth: 1.5, borderColor: "rgba(255,215,0,0.3)", alignItems: "center", justifyContent: "center" },
  proUpsellHeaderText: { flex: 1 },
  proUpsellTitle: { fontSize: 18, fontWeight: "900", color: "#F0F4FF" },
  proUpsellSub: { fontSize: 12, color: "#7A8AB0", marginTop: 2 },
  proTag: { backgroundColor: "#FFD700", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  proTagText: { fontSize: 10, fontWeight: "900", color: "#050811", letterSpacing: 1 },
  proUpsellPerks: { gap: 10 },
  proPerkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  proPerkIconWrap: { width: 28, height: 28, borderRadius: 8, backgroundColor: alpha(NEON_CYAN, "10"), borderWidth: 1, borderColor: alpha(NEON_CYAN, "20"), alignItems: "center", justifyContent: "center" },
  proPerkText: { fontSize: 13, color: "#B0BCD8", fontWeight: "600", flex: 1 },
  proUpsellPriceRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  proUpsellPrice: { fontSize: 28, fontWeight: "900", color: "#FFD700" },
  proUpsellPricePeriod: { fontSize: 12, color: "#7A8AB0", fontWeight: "600" },
  authCard: { borderRadius: 10, padding: 22, gap: 16, overflow: "hidden", borderWidth: 2, borderColor: "rgba(49,92,255,0.55)", backgroundColor: Colors.light.surfaceDeep },
  authCardLabel: { fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: NEON_CYAN, fontWeight: "800" },
  authInput: { backgroundColor: APP_BACKGROUND, borderRadius: 4, paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, color: Colors.light.text, borderWidth: 2, borderColor: Colors.light.border },
  primaryBtn: { backgroundColor: NEON_CYAN, borderRadius: 4, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 3, borderColor: "#FFF3A3", shadowColor: NEON_CYAN, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  primaryBtnDisabled: { opacity: 0.35 },
  primaryBtnText: { fontSize: 16, fontWeight: "900", color: "#050811", letterSpacing: 0.3 },
  authFooter: { fontSize: 9, letterSpacing: 2, color: "#2A3556", fontWeight: "700", textAlign: "center", textTransform: "uppercase" },
  navLeftButton: { position: "absolute", left: 18, bottom: 150, zIndex: 25, borderRadius: 999, overflow: "hidden" },
  navRightButton: { position: "absolute", right: 18, bottom: 150, zIndex: 25, borderRadius: 999, overflow: "hidden" },
  navButtonBlur: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: "rgba(8,14,28,0.7)", borderWidth: 1, borderColor: alpha(NEON_CYAN, "20") },
});
