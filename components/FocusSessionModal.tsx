import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Vibration,
} from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Check, Clock, Lock, X } from "lucide-react-native";

type Props = {
  visible: boolean;
  durationMinutes: number;
  challengeTitle: string;
  challengeId: string;
  nodeColor: string;
  onClose: () => void;
  onComplete: () => void;
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
 * Full-screen distraction-free focus session timer.
 *
 * Expo cannot block other apps at the OS level (that requires Apple's Family
 * Controls / Screen Time API on a native app, or Android's Accessibility
 * Service — both need a bespoke native module and a paid developer account
 * on iOS). This modal provides an in-app focus environment instead: it fills
 * the screen and times the session. Marked interrupted if closed early.
 */
export function FocusSessionModal({
  visible,
  durationMinutes,
  challengeTitle,
  nodeColor,
  onClose,
  onComplete,
}: Props) {
  const totalSeconds = durationMinutes * 60;
  const [remaining, setRemaining] = useState<number>(totalSeconds);
  const [phase, setPhase] = useState<"running" | "completed" | "interrupted">("running");
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const ringProgress = useRef(new Animated.Value(0)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (visible) {
      setRemaining(totalSeconds);
      setPhase("running");
      ringProgress.setValue(0);
      startTimeRef.current = Date.now();
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 10, useNativeDriver: true }),
      ]).start();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      overlayOpacity.setValue(0);
      scaleAnim.setValue(0.92);
    }
  }, [visible, totalSeconds, overlayOpacity, scaleAnim, ringProgress]);

  useEffect(() => {
    if (!visible || phase !== "running") return;
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const newRemaining = Math.max(0, totalSeconds - elapsed);
      setRemaining(newRemaining);
      const progress = totalSeconds > 0 ? (totalSeconds - newRemaining) / totalSeconds : 0;
      ringProgress.setValue(progress);

      if (newRemaining <= 0) {
        setPhase("completed");
        if (intervalRef.current) clearInterval(intervalRef.current);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Vibration.vibrate([0, 200, 100, 200]);
      } else if (newRemaining <= 5 && newRemaining > 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }, 250);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [visible, phase, totalSeconds, ringProgress]);

  const handleComplete = useCallback(() => {
    Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    onComplete();
  }, [overlayOpacity, onComplete]);

  const handleCancel = useCallback(() => {
    if (phase === "running") {
      setPhase("interrupted");
    }
    Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      onClose();
    });
  }, [overlayOpacity, phase, onClose]);

  const progressValue = totalSeconds > 0 ? (totalSeconds - remaining) / totalSeconds : 0;
  const ringSize = 220;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleCancel}>
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <BlurView tint="dark" intensity={100} style={StyleSheet.absoluteFillObject} />

        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.lockBar}>
            <Lock size={12} color={nodeColor} strokeWidth={2.5} />
            <Text style={[styles.lockText, { color: nodeColor }]}>FOCUS MODE</Text>
          </View>

          <View style={styles.ringWrap}>
            <View style={[styles.ringOuter, { borderColor: `${nodeColor}30` }]}>
              <View style={[styles.ringMid, { borderColor: `${nodeColor}18` }]}>
                <View style={styles.ringInner}>
                  <Text style={[styles.timeText, { color: phase === "completed" ? nodeColor : "#F0F4FF" }]}>
                    {formatTime(remaining)}
                  </Text>
                  <Text style={styles.timeLabel}>
                    {phase === "completed" ? "COMPLETE" : phase === "interrupted" ? "INTERRUPTED" : "REMAINING"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
              <Animated.View style={{ transform: [{ rotate: "-90deg" }] }}>
                <View style={{ width: ringSize, height: ringSize, alignItems: "center", justifyContent: "center" }}>
                  <View
                    style={{
                      width: ringSize,
                      height: ringSize,
                      borderRadius: ringSize / 2,
                      borderWidth: 3,
                      borderColor: phase === "completed" ? nodeColor : `${nodeColor}50`,
                      borderBottomColor: "transparent",
                      borderLeftColor: "transparent",
                      transform: [{ rotate: `${progressValue * 360}deg` }],
                    }}
                  />
                </View>
              </Animated.View>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.challengeLabel}>FOCUS CHALLENGE</Text>
            <Text style={styles.challengeTitle}>{challengeTitle}</Text>
            <View style={styles.durationRow}>
              <Clock size={12} color={nodeColor} strokeWidth={2.2} />
              <Text style={[styles.durationText, { color: nodeColor }]}>{durationMinutes} minute session</Text>
            </View>
          </View>

          {phase === "completed" ? (
            <View style={[styles.statusBanner, { borderColor: `${nodeColor}40`, backgroundColor: `${nodeColor}15` }]}>
              <Check size={16} color={nodeColor} strokeWidth={3} />
              <Text style={[styles.statusText, { color: nodeColor }]}>Session complete! Challenge verified.</Text>
            </View>
          ) : phase === "interrupted" ? (
            <View style={styles.statusBanner}>
              <Text style={styles.statusTextMuted}>Session interrupted. Stay in the app to complete your focus session.</Text>
            </View>
          ) : (
            <View style={styles.hintBox}>
              <Text style={styles.hintText}>Stay in this screen until the timer completes.{"\n"}Leaving the app will interrupt your session.</Text>
            </View>
          )}

          <View style={styles.actionRow}>
            {phase === "completed" ? (
              <Pressable
                onPress={handleComplete}
                style={({ pressed }) => [styles.completeBtn, { backgroundColor: nodeColor, borderColor: nodeColor }, pressed && { opacity: 0.88 }]}
              >
                <Check size={18} color="#050811" strokeWidth={3} />
                <Text style={styles.completeBtnText}>Claim Reward</Text>
              </Pressable>
            ) : (
              <Pressable onPress={handleCancel} style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}>
                <X size={16} color="#7A8AB0" strokeWidth={2.4} />
                <Text style={styles.cancelBtnText}>End Session</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: {
    width: "88%", maxWidth: 360, borderRadius: 32, overflow: "hidden",
    borderWidth: 1.5, borderColor: "rgba(93,225,255,0.15)", backgroundColor: "rgba(8,14,28,0.92)",
    paddingVertical: 28, paddingHorizontal: 24, alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 40, shadowOffset: { width: 0, height: 20 }, elevation: 30,
  },
  lockBar: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1, borderColor: "rgba(93,225,255,0.12)", backgroundColor: "rgba(255,255,255,0.04)", marginBottom: 24,
  },
  lockText: { fontSize: 10, fontWeight: "900", letterSpacing: 2.5 },
  ringWrap: { width: 220, height: 220, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  ringOuter: { width: 220, height: 220, borderRadius: 110, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  ringMid: { width: 190, height: 190, borderRadius: 95, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  ringInner: { width: 160, height: 160, borderRadius: 80, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.02)" },
  timeText: { fontSize: 44, fontWeight: "900", letterSpacing: -1, fontVariant: ["tabular-nums"] },
  timeLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 2.5, color: "#4A5680", marginTop: 6 },
  infoCard: { alignItems: "center", gap: 6, marginBottom: 20 },
  challengeLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 2, color: "#4A5680" },
  challengeTitle: { fontSize: 18, fontWeight: "800", color: "#F0F4FF", textAlign: "center" },
  durationRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  durationText: { fontSize: 13, fontWeight: "700" },
  statusBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  statusText: { fontSize: 13, fontWeight: "700", flex: 1 },
  statusTextMuted: { fontSize: 13, fontWeight: "600", color: "#7A8AB0", textAlign: "center", flex: 1 },
  hintBox: {
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1, borderColor: "rgba(93,225,255,0.06)", marginBottom: 20,
  },
  hintText: { fontSize: 12, lineHeight: 18, color: "#5A6B92", textAlign: "center", fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  completeBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16, borderWidth: 1 },
  completeBtnText: { fontSize: 15, fontWeight: "900", color: "#050811" },
  cancelBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.04)",
  },
  cancelBtnText: { fontSize: 13, fontWeight: "700", color: "#7A8AB0" },
});
