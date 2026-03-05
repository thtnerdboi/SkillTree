import React, { useCallback, useRef, useEffect, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  Check,
  Lock,
  Sparkles,
  X,
  Zap,
} from "lucide-react-native";
import { useMutation } from "@tanstack/react-query";
import { generateObject } from "@rork-ai/toolkit-sdk";
import { z } from "zod";
import Colors from "@/constants/colors";
import {
  Challenge,
  DOMAIN_COLOR,
  DOMAIN_LABEL,
  SKILL_NODES,
} from "@/mocks/mvp-data";
import { useAppState } from "@/state/app-state";

type IconComponent = React.ComponentType<{ size: number; color: string; strokeWidth: number }>;

type Props = {
  node: (typeof SKILL_NODES)[0];
  onClose: () => void;
  iconMap: Record<string, IconComponent>;
  flashXP: (amount: number) => void;
};

export function NodePanel({ node, onClose, iconMap, flashXP }: Props) {
  const { state, toggleChallenge, setAiChallenges, isNodeComplete, isNodeUnlocked, recordAiGeneration } = useAppState();
  const [goalInput, setGoalInput] = useState<string>("");
  const panelAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(panelAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 13,
    }).start();
  }, [panelAnim]);

  const close = useCallback(() => {
    Animated.timing(panelAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => onClose());
  }, [panelAnim, onClose]);

  const panelTranslateY = panelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  const regenerateNodeMutation = useMutation({
    mutationFn: async ({ goal }: { goal: string }) => {
      const result = await generateObject({
        messages: [
          {
            role: "user",
            content: `Generate 3 specific daily challenges for "${node.title}". Goal: ${goal}. Description: ${node.description}`,
          },
        ],
        schema: z.object({
          challenges: z.array(
            z.object({
              title: z.string(),
              detail: z.string(),
            })
          ).length(3),
        }),
      });

      const xpValues = node.defaultChallenges.map((c) => c.xp);
      return result.challenges.map((c, i) => ({
        id: `ai-${node.id}-${i}-${Date.now()}`,
        nodeId: node.id,
        title: c.title,
        detail: c.detail,
        xp: xpValues[i] ?? 30,
      }));
    },
    onSuccess: (challenges) => {
      setAiChallenges(node.id, challenges);
      setGoalInput("");
    },
    onError: (e) => {
      console.error("[panel] AI generation failed:", e);
      Alert.alert("Generation Failed", "Please check your connection and try again.");
    },
  });

  const nodeColor = DOMAIN_COLOR[node.domainId];
  const nodeUnlocked = isNodeUnlocked(node.id);
  const nodeComplete = isNodeComplete(node.id);
  const hasAiChallenges = (state.aiChallenges[node.id] ?? []).length > 0;
  const activeChallenges = hasAiChallenges ? state.aiChallenges[node.id] : node.defaultChallenges;
  const nodeProgress = activeChallenges.filter((c) => state.challengeProgress[c.id]).length;
  const NodeIcon = iconMap[node.icon];

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
      regenerateNodeMutation.mutate({ goal: goalInput.trim() });
    }
  };

  return (
    <>
      <Pressable style={styles.backdrop} onPress={close} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "position" : undefined} style={styles.panelKAV}>
        <Animated.View style={[styles.panel, { transform: [{ translateY: panelTranslateY }] }]}>
          <View style={styles.panelHandle} />
          <ScrollView 
            style={styles.panelScroll} 
            contentContainerStyle={styles.panelScrollContent} 
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.panelTopRow}>
              <View style={styles.panelTitleBlock}>
                <View style={[styles.panelDomainChip, { backgroundColor: `${nodeColor}18`, borderColor: `${nodeColor}40` }]}>
                  {NodeIcon && <NodeIcon size={11} color={nodeColor} strokeWidth={2} />}
                  <Text style={[styles.panelDomainChipText, { color: nodeColor }]}>{DOMAIN_LABEL[node.domainId]}</Text>
                </View>
                <Text style={styles.panelTitle}>{node.title}</Text>
              </View>
              <Pressable style={styles.closeBtn} onPress={close}>
                <X size={15} color={Colors.light.muted} />
              </Pressable>
            </View>

            <Text style={styles.panelDesc}>{node.description}</Text>

            {nodeComplete && (
              <View style={[styles.completedBanner, { borderColor: `${nodeColor}40`, backgroundColor: `${nodeColor}10` }]}>
                <Check size={14} color={nodeColor} strokeWidth={2.5} />
                <Text style={[styles.completedBannerText, { color: nodeColor }]}>Node Complete! +100 Bonus XP earned</Text>
              </View>
            )}

            {/* Personalization Section */}
            {nodeUnlocked && (
              <View style={styles.regenSection}>
                <View style={styles.regenLabelRow}>
                  <Sparkles size={12} color={nodeColor} strokeWidth={2} />
                  <Text style={styles.regenLabel}>PERSONALIZE CHALLENGES</Text>
                </View>
                <TextInput
                  style={[styles.regenInput, { borderColor: goalInput.length > 0 ? `${nodeColor}50` : "#1A2030" }]}
                  value={goalInput}
                  onChangeText={setGoalInput}
                  placeholder={node.goalPrompt}
                  placeholderTextColor="#2A3560"
                  multiline
                  numberOfLines={2}
                />
                <TouchableOpacity
                  style={[
                    styles.regenBtn,
                    goalInput.trim().length > 8 && !regenerateNodeMutation.isPending
                      ? { backgroundColor: nodeColor }
                      : { backgroundColor: "#0E1320", borderColor: "#1A2030", borderWidth: 1 },
                  ]}
                  onPress={handleRegenerate}
                  disabled={goalInput.trim().length <= 8 || regenerateNodeMutation.isPending}
                >
                  {regenerateNodeMutation.isPending ? (
                    <ActivityIndicator size="small" color={nodeColor} />
                  ) : (
                    <>
                      <Sparkles size={13} color={goalInput.trim().length > 8 ? "#060810" : "#2A3560"} strokeWidth={2} />
                      <Text style={[styles.regenBtnText, { color: goalInput.trim().length > 8 ? "#060810" : "#2A3560" }]}>
                        {hasAiChallenges ? "Regenerate" : "Generate My Goals"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Challenges List */}
            <View style={styles.challengeSection}>
              <View style={styles.challengeHeader}>
                <Text style={styles.challengeHeaderTitle}>CHALLENGES</Text>
                <Text style={[styles.challengeHeaderProg, { color: nodeColor }]}>{nodeProgress}/{activeChallenges.length}</Text>
              </View>

              {activeChallenges.map((challenge) => {
                const done = state.challengeProgress[challenge.id] ?? false;
                return (
                  <Pressable
                    key={challenge.id}
                    style={({ pressed }) => [
                      styles.challengeRow,
                      done && styles.challengeRowDone,
                      pressed && { opacity: 0.75 },
                      !nodeUnlocked && styles.challengeRowLocked,
                    ]}
                    onPress={() => {
                      if (!nodeUnlocked) return;
                      toggleChallenge(challenge.id, node.id, challenge.xp);
                      if (!done) flashXP(challenge.xp);
                    }}
                  >
                    <View style={[styles.challengeCheck, done && { backgroundColor: nodeColor, borderColor: nodeColor }]}>
                      {done && <Check size={11} color="#000" strokeWidth={3} />}
                    </View>
                    <View style={styles.challengeText}>
                      <Text style={[styles.challengeTitle, done && styles.challengeTitleDone]}>{challenge.title}</Text>
                      <Text style={styles.challengeDetail}>{challenge.detail}</Text>
                    </View>
                    <View style={[styles.xpPill, { backgroundColor: `${nodeColor}15`, borderColor: `${nodeColor}30` }]}>
                      <Zap size={9} color={nodeColor} strokeWidth={2.5} />
                      <Text style={[styles.xpPillText, { color: nodeColor }]}>+{challenge.xp}</Text>
                    </View>
                    {!nodeUnlocked && <Lock size={12} color="#2A3060" />}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 8 },
  panelKAV: { position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10 },
  panel: { 
    backgroundColor: "#0C1120", // Solid background for Android
    borderTopLeftRadius: 30, 
    borderTopRightRadius: 30, 
    borderTopWidth: 1, 
    borderColor: "#1A2238", 
    paddingTop: 12, 
    elevation: 28, // Shadow for Android
    overflow: "hidden", // Fixes polygon bleed
    maxHeight: 580,
    shadowColor: "#000",
    shadowOpacity: 0.8,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -8 },
  },
  panelHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#202840", alignSelf: "center", marginBottom: 16 },
  panelScroll: { maxHeight: 540 },
  panelScrollContent: { paddingHorizontal: 22, paddingBottom: 50, gap: 16 },
  panelTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  panelTitleBlock: { gap: 6, flex: 1 },
  panelDomainChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, alignSelf: "flex-start" },
  panelDomainChipText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  panelTitle: { fontSize: 28, fontWeight: "900", color: Colors.light.text, lineHeight: 32 },
  panelDesc: { fontSize: 14, lineHeight: 22, color: Colors.light.muted },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#0E1320", alignItems: "center", justifyContent: "center" },
  completedBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1 },
  completedBannerText: { fontSize: 13, fontWeight: "700", flex: 1 },
  regenSection: { backgroundColor: "#080B14", borderRadius: 18, padding: 16, gap: 10, borderWidth: 1, borderColor: "#141C2E", overflow: "hidden" },
  regenLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  regenLabel: { fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: Colors.light.muted, fontWeight: "700" },
  regenInput: { backgroundColor: "#060810", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.light.text, borderWidth: 1, lineHeight: 20, minHeight: 60, textAlignVertical: "top" },
  regenBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 13, overflow: "hidden" },
  regenBtnText: { fontSize: 14, fontWeight: "700", letterSpacing: 0.3 },
  challengeSection: { gap: 8 },
  challengeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  challengeHeaderTitle: { fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", color: Colors.light.muted, fontWeight: "700" },
  challengeHeaderProg: { fontSize: 13, fontWeight: "800" },
  challengeRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#080B14", borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1, borderColor: "#141C2E", overflow: "hidden" },
  challengeRowDone: { borderColor: "#1A2438", backgroundColor: "#060910" },
  challengeRowLocked: { opacity: 0.5 },
  challengeCheck: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: "#232840", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  challengeText: { flex: 1 },
  challengeTitle: { fontSize: 14, fontWeight: "600", color: Colors.light.text },
  challengeTitleDone: { textDecorationLine: "line-through", color: Colors.light.muted },
  challengeDetail: { fontSize: 12, color: Colors.light.muted, marginTop: 2 },
  xpPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  xpPillText: { fontSize: 11, fontWeight: "700" },
});