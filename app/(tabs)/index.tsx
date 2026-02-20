import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
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
  ChevronRight,
  Eye,
  Flame,
  Hammer,
  Heart,
  Lightbulb,
  Lock,
  Sparkles,
  Trophy,
  Wind,
  Zap,
} from "lucide-react-native";
import { generateObject } from "@rork-ai/toolkit-sdk";
import { z } from "zod";

import Colors from "@/constants/colors";
import {
  Challenge,
  DOMAIN_COLOR,
  SKILL_NODES,
  getUserLevel,
  getXpForCurrentLevel,
  getXpForNextLevel,
} from "@/mocks/mvp-data";
import { useAppState, OnboardingAnswers } from "@/state/app-state";
import { OnboardingScreens } from "@/components/OnboardingScreens";
import { NodePanel } from "@/components/NodePanel";
import { PrestigeModal } from "@/components/PrestigeModal";

type IconComp = React.ComponentType<{ size: number; color: string; strokeWidth: number }>;

const ICON_MAP: Record<string, IconComp> = {
  Heart, Wind, Activity, Eye, Flame, Lightbulb, Sparkles, Hammer, Zap, Award, Trophy,
};

const ONBOARD_SCHEMA = z.object({
  nodes: z.array(z.object({
    nodeId: z.string(),
    challenges: z.array(z.object({ title: z.string(), detail: z.string() })).min(3).max(3),
  })),
});

// Tree canvas Y positions (0=top, increases downward; Origin is at BOTTOM)
const ORIGIN_Y = 1340;
const ROW1_Y = 1040;
const ROW2_Y = 740;
const ROW3_Y = 440;
const ROW4_Y = 160;
const CANVAS_H = 1500;

// Node sizes
const CIRCLE_SIZE = 68;
const SQUARE_SIZE = 60;
const ORIGIN_SIZE = 88;

type NodeShape = "circle" | "square";
interface NodeLayout { xFrac: number; y: number; shape: NodeShape }

const NODE_LAYOUT: Record<string, NodeLayout> = {
  vitality:  { xFrac: 0.5,  y: ROW1_Y, shape: "circle" },
  stillness: { xFrac: 0.18, y: ROW1_Y, shape: "square" },
  spark:     { xFrac: 0.82, y: ROW1_Y, shape: "square" },
  motion:    { xFrac: 0.5,  y: ROW2_Y, shape: "circle" },
  clarity:   { xFrac: 0.18, y: ROW2_Y, shape: "square" },
  forge:     { xFrac: 0.82, y: ROW2_Y, shape: "square" },
  power:     { xFrac: 0.5,  y: ROW3_Y, shape: "circle" },
  insight:   { xFrac: 0.18, y: ROW3_Y, shape: "square" },
  mastery:   { xFrac: 0.82, y: ROW3_Y, shape: "square" },
  peak:      { xFrac: 0.5,  y: ROW4_Y, shape: "circle" },
  flow:      { xFrac: 0.18, y: ROW4_Y, shape: "square" },
};

const CONNECTIONS: Array<[string, string]> = [
  ["origin", "vitality"],
  ["origin", "stillness"],
  ["origin", "spark"],
  ["vitality", "motion"],
  ["stillness", "clarity"],
  ["spark", "forge"],
  ["motion", "power"],
  ["clarity", "insight"],
  ["forge", "mastery"],
  ["power", "peak"],
  ["insight", "flow"],
];

// ── Progress Ring ─────────────────────────────────────────────────
function ProgressRing({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.min(completed / total, 1) : 0;
  const R = 29;
  const CIRC = 2 * Math.PI * R;
  const filled = pct * CIRC;

  return (
    <View style={ringStyles.wrap}>
      <Svg width={74} height={74}>
        <SvgCircle cx={37} cy={37} r={R} stroke="#1A2550" strokeWidth={4} fill="none" />
        <SvgCircle
          cx={37} cy={37} r={R}
          stroke={Colors.light.tint}
          strokeWidth={4}
          fill="none"
          strokeDasharray={[filled, CIRC - filled]}
          strokeDashoffset={CIRC / 4}
          strokeLinecap="round"
        />
      </Svg>
      <View style={ringStyles.inner}>
        <Text style={ringStyles.pct}>{Math.round(pct * 100)}%</Text>
        <Text style={ringStyles.count}>{completed}/{total}</Text>
      </View>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  wrap: { width: 74, height: 74, alignItems: "center", justifyContent: "center" },
  inner: { position: "absolute", alignItems: "center" },
  pct: { fontSize: 15, fontWeight: "900", color: Colors.light.text },
  count: { fontSize: 9, fontWeight: "600", color: Colors.light.muted },
});

// ── Main Screen ───────────────────────────────────────────────────
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

  const scrollRef = useRef<ScrollView>(null);
  const hasScrolled = useRef(false);
  const xpFlashAnim = useRef(new Animated.Value(0)).current;
  const [xpGained, setXpGained] = useState<number>(0);

  const flashXP = useCallback((amount: number) => {
    setXpGained(amount);
    xpFlashAnim.setValue(1);
    Animated.timing(xpFlashAnim, { toValue: 0, duration: 1800, useNativeDriver: true }).start();
  }, [xpFlashAnim]);

  const handleContentSizeChange = useCallback(() => {
    if (!hasScrolled.current) {
      scrollRef.current?.scrollToEnd({ animated: false });
      hasScrolled.current = true;
    }
  }, []);

  const generateOnboardingChallenges = useCallback(async (answers: OnboardingAnswers) => {
    setGeneratingChallenges(true);
    setGenerateError(null);
    console.log("[onboard] Generating AI challenges for all nodes");
    try {
      const bodyNodes = SKILL_NODES.filter((n) => n.domainId === "body");
      const mindNodes = SKILL_NODES.filter((n) => n.domainId === "mind");
      const craftNodes = SKILL_NODES.filter((n) => n.domainId === "craft");

      const buildPrompt = (goal: string, domainLabel: string, nodes: typeof SKILL_NODES) =>
        `You are a personal development coach. User's ${domainLabel} goal: "${goal}". Generate exactly 3 specific daily challenges for each of these nodes: ${nodes.map((n) => `${n.id}: "${n.title}" — ${n.description}`).join(", ")}. Each challenge: 2–4 word title, 3–6 word detail. Return nodeId matching exactly.`;

      const [bodyResult, mindResult, craftResult] = await Promise.all([
        generateObject({ messages: [{ role: "user", content: buildPrompt(answers.body, "Body", bodyNodes) }], schema: ONBOARD_SCHEMA }),
        generateObject({ messages: [{ role: "user", content: buildPrompt(answers.mind, "Mind", mindNodes) }], schema: ONBOARD_SCHEMA }),
        generateObject({ messages: [{ role: "user", content: buildPrompt(answers.craft, "Craft", craftNodes) }], schema: ONBOARD_SCHEMA }),
      ]);

      const allGenerated: Record<string, Challenge[]> = {};
      const processResult = (result: typeof bodyResult, nodes: typeof SKILL_NODES) => {
        result.nodes.forEach((n) => {
          const node = nodes.find((sn) => sn.id === n.nodeId);
          if (!node) return;
          allGenerated[n.nodeId] = n.challenges.map((c, i) => ({
            id: `ai-${n.nodeId}-${i}`,
            nodeId: n.nodeId,
            title: c.title,
            detail: c.detail,
            xp: node.defaultChallenges[i]?.xp ?? 50,
          }));
        });
      };
      processResult(bodyResult, bodyNodes);
      processResult(mindResult, mindNodes);
      processResult(craftResult, craftNodes);

      console.log("[onboard] Generated challenges for", Object.keys(allGenerated).length, "nodes");
      completeOnboarding(answers, allGenerated);
    } catch (err) {
      console.error("[onboard] Generation failed:", err);
      setGenerateError("Failed to generate. Tap retry.");
    } finally {
      setGeneratingChallenges(false);
    }
  }, [completeOnboarding]);

  // ── Auth Screen ──────────────────────────────────────────────────
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
              {["AI-personalized challenges", "XP & level progression", "Compete with friends"].map((f) => (
                <View key={f} style={styles.authFeatureRow}>
                  <View style={styles.authFeatureDot} />
                  <Text style={styles.authFeatureText}>{f}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // ── Onboarding ───────────────────────────────────────────────────
  if (!state.onboardingComplete) {
    return (
      <OnboardingScreens
        onComplete={generateOnboardingChallenges}
        isGenerating={generatingChallenges}
        generateError={generateError}
      />
    );
  }

  // ── Main Tree ────────────────────────────────────────────────────
  const currentLevel = getUserLevel(state.xp);
  const xpCurrent = getXpForCurrentLevel(currentLevel);
  const xpNext = getXpForNextLevel(currentLevel);
  const xpProgress = xpNext > xpCurrent ? (state.xp - xpCurrent) / (xpNext - xpCurrent) : 1;

  return (
    <View style={styles.shell}>
      <SafeAreaView style={styles.safeArea}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>SkillTree</Text>
            <Text style={styles.greeting}>Hey {state.displayName || "Adventurer"}</Text>
          </View>
          <ProgressRing completed={completedChallenges} total={totalChallenges} />
        </View>

        {/* Domain legend */}
        <View style={styles.legend}>
          {(["mind", "body", "craft"] as const).map((d) => (
            <View key={d} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: DOMAIN_COLOR[d] }]} />
              <Text style={styles.legendLabel}>{d.charAt(0).toUpperCase() + d.slice(1)}</Text>
            </View>
          ))}
        </View>

        {/* XP progress bar */}
        <View style={styles.xpBarWrap}>
          <View style={styles.xpBarTrack}>
            <View style={[styles.xpBarFill, { width: `${Math.min(xpProgress * 100, 100)}%` as any }]} />
          </View>
          <Text style={styles.xpBarLabel}>
            LV{currentLevel} · {state.xp - xpCurrent} / {xpNext - xpCurrent} XP to next level
          </Text>
        </View>

        {/* XP flash */}
        <Animated.View
          style={[styles.xpFlash, { opacity: xpFlashAnim }]}
          pointerEvents="none"
        >
          <Zap size={12} color={Colors.light.tint} strokeWidth={2.5} />
          <Text style={styles.xpFlashText}>+{xpGained} XP</Text>
        </Animated.View>

        {/* Skill Tree */}
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={handleContentSizeChange}
        >
          <View style={{ width, height: CANVAS_H }}>

            {/* Ambient glow at origin */}
            <View style={[styles.originGlow, {
              left: width * 0.5 - 110,
              top: ORIGIN_Y - 110,
            }]} />

            {/* SVG connector lines */}
            <Svg
              width={width}
              height={CANVAS_H}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            >
              {CONNECTIONS.map(([fromId, toId], i) => {
                const fromLayout = NODE_LAYOUT[fromId];
                const fromX = fromId === "origin" ? width * 0.5 : width * (fromLayout?.xFrac ?? 0.5);
                const fromY = fromId === "origin" ? ORIGIN_Y : (fromLayout?.y ?? ORIGIN_Y);
                const toLayout = NODE_LAYOUT[toId];
                if (!toLayout) return null;
                const toX = width * toLayout.xFrac;
                const toY = toLayout.y;
                const toNode = SKILL_NODES.find((n) => n.id === toId);
                const domColor = toNode ? DOMAIN_COLOR[toNode.domainId] : Colors.light.tint;
                const active = toNode ? isNodeUnlocked(toNode.id) : true;
                return (
                  <SvgLine
                    key={i}
                    x1={fromX} y1={fromY}
                    x2={toX} y2={toY}
                    stroke={active ? domColor + "55" : "#1A2240"}
                    strokeWidth={1.5}
                  />
                );
              })}
            </Svg>

            {/* Origin node */}
            <View style={[styles.originNode, {
              left: width * 0.5 - ORIGIN_SIZE / 2,
              top: ORIGIN_Y - ORIGIN_SIZE / 2,
            }]}>
              <Zap size={30} color={Colors.light.tint} strokeWidth={2} />
            </View>
            <View
              pointerEvents="none"
              style={[styles.labelWrap, {
                left: width * 0.5 - 45,
                top: ORIGIN_Y + ORIGIN_SIZE / 2 + 8,
                width: 90,
              }]}
            >
              <Text style={[styles.nodeLabel, { color: Colors.light.text, fontSize: 14 }]}>Origin</Text>
            </View>

            {/* Skill nodes */}
            {SKILL_NODES.map((node) => {
              const layout = NODE_LAYOUT[node.id];
              if (!layout) return null;

              const nodeX = width * layout.xFrac;
              const nodeY = layout.y;
              const unlocked = isNodeUnlocked(node.id);
              const complete = isNodeComplete(node.id);
              const domColor = DOMAIN_COLOR[node.domainId];
              const NodeIcon = ICON_MAP[node.icon];
              const isCircle = layout.shape === "circle";
              const size = isCircle ? CIRCLE_SIZE : SQUARE_SIZE;
              const half = size / 2;
              const br = isCircle ? half : 15;

              const challenges =
                (state.aiChallenges[node.id] ?? []).length > 0
                  ? state.aiChallenges[node.id]
                  : node.defaultChallenges;
              const done = challenges.filter((c) => state.challengeProgress[c.id]).length;
              const hasProgress = done > 0 && !complete;

              return (
                <React.Fragment key={node.id}>
                  <Pressable
                    testID={`node-${node.id}`}
                    style={({ pressed }) => [
                      styles.nodeAbs,
                      {
                        left: nodeX - half,
                        top: nodeY - half,
                        width: size,
                        height: size,
                        borderRadius: br,
                        shadowColor: unlocked ? domColor : "transparent",
                      },
                      unlocked
                        ? {
                            borderColor: complete ? domColor : domColor + "70",
                            backgroundColor: complete ? domColor + "22" : domColor + "14",
                            borderWidth: complete ? 2.5 : 2,
                          }
                        : {
                            borderColor: "#1A2240",
                            backgroundColor: "#0A0D18",
                            borderWidth: 1.5,
                            opacity: 0.4,
                          },
                      pressed && unlocked && { opacity: 0.75, transform: [{ scale: 0.93 }] },
                    ]}
                    onPress={() => unlocked && setSelectedNode(node)}
                  >
                    {unlocked && NodeIcon ? (
                      <NodeIcon
                        size={isCircle ? 26 : 22}
                        color={complete ? domColor : domColor + "CC"}
                        strokeWidth={2}
                      />
                    ) : (
                      <Lock size={15} color="#2A3050" strokeWidth={2} />
                    )}

                    {/* Progress dot for partial completion */}
                    {hasProgress && (
                      <View style={[styles.progressDot, {
                        backgroundColor: domColor,
                        right: isCircle ? -3 : -3,
                        top: isCircle ? 4 : -3,
                      }]} />
                    )}

                    {/* Complete badge */}
                    {complete && (
                      <View style={[styles.completeBadge, {
                        backgroundColor: domColor,
                        borderColor: "#060810",
                        top: isCircle ? -5 : -6,
                        right: isCircle ? -5 : -6,
                      }]}>
                        <Text style={styles.completeBadgeCheck}>✓</Text>
                      </View>
                    )}
                  </Pressable>

                  {/* Label below node */}
                  <View
                    pointerEvents="none"
                    style={[styles.labelWrap, {
                      left: nodeX - 45,
                      top: nodeY + half + 7,
                      width: 90,
                    }]}
                  >
                    <Text
                      style={[styles.nodeLabel, { color: unlocked ? Colors.light.text : "#2A3050" }]}
                      numberOfLines={1}
                    >
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

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#060810" },
  safeArea: { flex: 1 },

  // ── Auth ─────────────────────────────────────────────────────────
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
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  primaryBtnDisabled: { opacity: 0.35 },
  primaryBtnText: { fontSize: 16, fontWeight: "800", color: "#060810", letterSpacing: 0.3 },

  // ── Header ───────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 4,
  },
  greeting: { fontSize: 24, fontWeight: "900", color: Colors.light.text, marginTop: 2 },

  // ── Legend ───────────────────────────────────────────────────────
  legend: { flexDirection: "row", justifyContent: "center", gap: 24, paddingVertical: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 7 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 13, fontWeight: "600", color: Colors.light.muted },

  // ── XP bar ───────────────────────────────────────────────────────
  xpBarWrap: { paddingHorizontal: 22, paddingBottom: 8, gap: 4 },
  xpBarTrack: { height: 3, backgroundColor: "#111828", borderRadius: 2, overflow: "hidden" },
  xpBarFill: { height: "100%", backgroundColor: Colors.light.tint, borderRadius: 2 },
  xpBarLabel: { fontSize: 10, color: "#2A3560", fontWeight: "600" },

  // ── XP flash ─────────────────────────────────────────────────────
  xpFlash: {
    position: "absolute",
    top: 148,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },

  xpFlashText: { fontSize: 15, fontWeight: "800", color: Colors.light.tint },

  // ── Tree canvas ───────────────────────────────────────────────────
  originGlow: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: `${Colors.light.tint}07`,
  },
  originNode: {
    position: "absolute",
    width: ORIGIN_SIZE,
    height: ORIGIN_SIZE,
    borderRadius: ORIGIN_SIZE / 2,
    backgroundColor: `${Colors.light.tint}18`,
    borderWidth: 2.5,
    borderColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.light.tint,
    shadowOpacity: 0.55,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },

  nodeAbs: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },

  progressDot: {
    position: "absolute",
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#060810",
  },

  completeBadge: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  completeBadgeCheck: { fontSize: 9, fontWeight: "900", color: "#000" },

  labelWrap: { position: "absolute", alignItems: "center" },
  nodeLabel: { fontSize: 13, fontWeight: "700", textAlign: "center" },
});
