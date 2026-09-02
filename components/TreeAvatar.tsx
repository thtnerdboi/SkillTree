import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Code2, Dumbbell, Lock, Sparkles, Zap } from "lucide-react-native";

import Colors from "@/constants/colors";
import { PixelAvatar, type AvatarConfig } from "@/components/PixelAvatar";

export type TreeAvatarPoint = { x: number; y: number };
export type AvatarActivity = "ready" | "meditate" | "lift" | "code";

type TreeAvatarProps = {
  avatar: AvatarConfig;
  target: TreeAvatarPoint;
  fallback: TreeAvatarPoint;
  unlocked: boolean;
  movementKey: string;
  activity: AvatarActivity;
  color: string;
  size?: number;
};

function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}

function activityMeta(activity: AvatarActivity) {
  if (activity === "lift") return { Icon: Dumbbell, label: "LIFT" };
  if (activity === "code") return { Icon: Code2, label: "CODE" };
  if (activity === "meditate") return { Icon: Sparkles, label: "ZEN" };
  return { Icon: Zap, label: "READY" };
}

export function TreeAvatar({
  avatar,
  target,
  fallback,
  unlocked,
  movementKey,
  activity,
  color,
  size = 120,
}: TreeAvatarProps) {
  const reduceMotion = useReduceMotion();
  const initial = unlocked ? target : fallback;
  const position = useRef(new Animated.ValueXY({ x: initial.x - size / 2, y: initial.y - size * 0.78 })).current;
  const wobble = useRef(new Animated.Value(0)).current;
  const squash = useRef(new Animated.Value(0)).current;
  const idle = useRef(new Animated.Value(0)).current;
  const blockedOpacity = useRef(new Animated.Value(unlocked ? 0 : 1)).current;
  const motionRef = useRef<Animated.CompositeAnimation | null>(null);
  const previousTargetRef = useRef<TreeAvatarPoint>({ x: target.x, y: target.y });
  const [blockedVisible, setBlockedVisible] = useState(!unlocked);

  useEffect(() => {
    const targetPosition = { x: target.x - size / 2, y: target.y - size * 0.78 };
    const fallbackPosition = { x: fallback.x - size / 2, y: fallback.y - size * 0.78 };
    const previousTarget = previousTargetRef.current;
    const switchedBranch = Math.abs(previousTarget.x - target.x) > 24;
    previousTargetRef.current = { x: target.x, y: target.y };

    motionRef.current?.stop();
    position.x.stopAnimation();
    position.y.stopAnimation();
    wobble.stopAnimation();
    squash.stopAnimation();

    if (reduceMotion) {
      position.setValue(unlocked ? targetPosition : fallbackPosition);
      wobble.setValue(0);
      squash.setValue(0);
      blockedOpacity.setValue(unlocked ? 0 : 1);
      setBlockedVisible(!unlocked);
      return;
    }

    if (!unlocked) {
      setBlockedVisible(true);
      blockedOpacity.setValue(0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      motionRef.current = Animated.sequence([
        Animated.parallel([
          Animated.spring(position.x, { toValue: targetPosition.x, stiffness: 220, damping: 22, mass: 0.8, useNativeDriver: true }),
          Animated.spring(position.y, { toValue: targetPosition.y + 12, stiffness: 210, damping: 20, mass: 0.8, useNativeDriver: true }),
          Animated.timing(blockedOpacity, { toValue: 1, duration: 130, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.sequence([
            Animated.timing(wobble, { toValue: -1, duration: 55, useNativeDriver: true }),
            Animated.timing(wobble, { toValue: 1, duration: 90, useNativeDriver: true }),
            Animated.timing(wobble, { toValue: -0.7, duration: 80, useNativeDriver: true }),
            Animated.spring(wobble, { toValue: 0, stiffness: 420, damping: 16, mass: 0.45, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(squash, { toValue: 1, duration: 90, useNativeDriver: true }),
            Animated.spring(squash, { toValue: 0, stiffness: 300, damping: 18, useNativeDriver: true }),
          ]),
        ]),
        Animated.parallel([
          Animated.spring(position.x, { toValue: fallbackPosition.x, stiffness: 125, damping: 19, mass: 0.95, useNativeDriver: true }),
          Animated.timing(position.y, { toValue: fallbackPosition.y, duration: 430, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        ]),
      ]);
      motionRef.current.start();
      return () => motionRef.current?.stop();
    }

    setBlockedVisible(false);
    blockedOpacity.setValue(0);
    const landing = Animated.sequence([
      Animated.timing(squash, { toValue: 1, duration: 70, useNativeDriver: true }),
      Animated.spring(squash, { toValue: 0, stiffness: 340, damping: 17, mass: 0.45, useNativeDriver: true }),
    ]);

    if (switchedBranch) {
      const jumpPeak = Math.min(previousTarget.y, target.y) - size * 0.72;
      motionRef.current = Animated.parallel([
        Animated.spring(position.x, { toValue: targetPosition.x, stiffness: 145, damping: 18, mass: 0.9, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(position.y, { toValue: jumpPeak, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.spring(position.y, { toValue: targetPosition.y, stiffness: 210, damping: 18, mass: 0.75, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(wobble, { toValue: target.x > previousTarget.x ? 1 : -1, duration: 150, useNativeDriver: true }),
          Animated.spring(wobble, { toValue: 0, stiffness: 260, damping: 13, mass: 0.6, useNativeDriver: true }),
        ]),
        Animated.sequence([Animated.delay(230), landing]),
      ]);
    } else {
      motionRef.current = Animated.parallel([
        Animated.spring(position.x, { toValue: targetPosition.x, stiffness: 190, damping: 22, mass: 0.8, useNativeDriver: true }),
        Animated.spring(position.y, { toValue: targetPosition.y, stiffness: 175, damping: 17, mass: 0.85, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(wobble, { toValue: target.y < previousTarget.y ? -0.55 : 0.55, duration: 120, useNativeDriver: true }),
          Animated.spring(wobble, { toValue: 0, stiffness: 270, damping: 15, mass: 0.6, useNativeDriver: true }),
        ]),
        Animated.sequence([Animated.delay(150), landing]),
      ]);
    }

    motionRef.current.start();
    return () => motionRef.current?.stop();
  }, [blockedOpacity, fallback.x, fallback.y, movementKey, position, reduceMotion, size, squash, target.x, target.y, unlocked, wobble]);

  useEffect(() => {
    idle.stopAnimation();
    idle.setValue(0);
    if (reduceMotion || !unlocked) return;

    const duration = activity === "lift" ? 520 : activity === "code" ? 360 : 920;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(idle, { toValue: 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(idle, { toValue: 0, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(activity === "code" ? 120 : 300),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [activity, idle, movementKey, reduceMotion, unlocked]);

  const { Icon, label } = activityMeta(activity);
  const rotate = wobble.interpolate({ inputRange: [-1, 0, 1], outputRange: ["-12deg", "0deg", "12deg"] });
  const scaleX = squash.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const scaleY = squash.interpolate({ inputRange: [0, 1], outputRange: [1, 0.84] });
  const idleY = idle.interpolate({
    inputRange: [0, 1],
    outputRange: [0, activity === "meditate" ? -7 : activity === "lift" ? 4 : -2],
  });
  const badgeRotate = idle.interpolate({ inputRange: [0, 1], outputRange: ["-5deg", "5deg"] });

  return (
    <Animated.View
      pointerEvents="none"
      accessible
      accessibilityLabel={unlocked ? `Player at ${movementKey}, ${label.toLowerCase()} animation` : `Player blocked from ${movementKey}`}
      style={[styles.positioner, { width: size, height: size, transform: position.getTranslateTransform() }]}
    >
      <Animated.View style={[styles.character, { transform: [{ translateY: idleY }, { rotate }, { scaleX }, { scaleY }] }]}>
        <PixelAvatar {...avatar} size={size} />
      </Animated.View>
      {!blockedVisible ? (
        <Animated.View style={[styles.activityBadge, { borderColor: color, transform: [{ rotate: badgeRotate }] }]}>
          <Icon size={12} color={color} strokeWidth={2.7} />
          <Text style={[styles.activityText, { color }]}>{label}</Text>
        </Animated.View>
      ) : (
        <Animated.View style={[styles.blockedBadge, { opacity: blockedOpacity }]}>
          <Lock size={11} color={Colors.light.background} strokeWidth={3} />
          <Text style={styles.blockedText}>NO ENTRY</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  positioner: { position: "absolute", left: 0, top: 0, zIndex: 14, overflow: "visible", alignItems: "center" },
  character: { width: "100%", height: "100%", shadowColor: "#000", shadowOpacity: 0.42, shadowRadius: 4, shadowOffset: { width: 0, height: 4 }, elevation: 18 },
  activityBadge: { position: "absolute", top: -13, right: -27, minWidth: 50, height: 25, paddingHorizontal: 6, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: Colors.light.surfaceDeep, borderWidth: 2 },
  activityText: { fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.6 },
  blockedBadge: { position: "absolute", top: -15, minWidth: 72, height: 26, paddingHorizontal: 7, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: Colors.light.error, borderWidth: 2, borderColor: "#FFB3B3" },
  blockedText: { fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.8, color: Colors.light.background },
});
