import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ChevronLeft, ChevronRight, Flame, Hammer, Sparkles, Wind } from "lucide-react-native";

import Colors from "@/constants/colors";
import { DOMAIN_COLOR } from "@/mocks/mvp-data";
import type { OnboardingAnswers } from "@/state/app-state";
import { AvatarCustomizer } from "@/components/AvatarCustomizer";
import { DEFAULT_AVATAR_CONFIG, type AvatarConfig } from "@/components/PixelAvatar";

type Props = {
  onComplete: (answers: OnboardingAnswers) => Promise<void>;
  isGenerating: boolean;
  generateError: string | null;
};

const TOTAL_STEPS = 5;
const GENERATING_STEP = 5;

function ArcadeBackdrop() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.mazeRail, styles.mazeRailTop]} />
      <View style={[styles.mazeRail, styles.mazeRailLeft]} />
      <View style={[styles.mazeRail, styles.mazeRailRight]} />
      <View style={[styles.mazeRail, styles.mazeRailBottom]} />
      <View style={styles.pelletRow}>
        {Array.from({ length: 11 }).map((_, index) => <View key={index} style={styles.pellet} />)}
      </View>
      <View style={[styles.pelletRow, styles.pelletRowBottom]}>
        {Array.from({ length: 11 }).map((_, index) => <View key={index} style={styles.pellet} />)}
      </View>
    </View>
  );
}

function StepDots({ active }: { active: number }) {
  return (
    <View accessibilityLabel={`Setup step ${Math.min(active + 1, TOTAL_STEPS)} of ${TOTAL_STEPS}`} style={styles.stepIndicator}>
      {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
        <View key={index} style={[styles.stepDot, index <= active && styles.stepDotComplete, index === active && styles.stepDotActive]} />
      ))}
    </View>
  );
}

function OnboardingShell({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.shell}>
      <ArcadeBackdrop />
      <SafeAreaView style={styles.safeArea}>{children}</SafeAreaView>
    </View>
  );
}

export function OnboardingScreens({ onComplete, isGenerating, generateError }: Props) {
  const [step, setStep] = useState<number>(0);
  const [bodyGoal, setBodyGoal] = useState<string>("");
  const [mindGoal, setMindGoal] = useState<string>("");
  const [craftGoal, setCraftGoal] = useState<string>("");
  const [avatar, setAvatar] = useState<AvatarConfig>(DEFAULT_AVATAR_CONFIG);
  const [isTakingLong, setIsTakingLong] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const welcomeScrollRef = useRef<ScrollView>(null);
  const goalScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!isGenerating) {
      pulseAnim.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 640, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 640, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [isGenerating, pulseAnim]);

  useEffect(() => {
    if (!isGenerating) {
      setIsTakingLong(false);
      return;
    }

    const timeout = setTimeout(() => setIsTakingLong(true), 7_000);
    return () => clearTimeout(timeout);
  }, [isGenerating]);

  useEffect(() => {
    if (step !== 0) return;

    const resetWelcomeScroll = () => {
      requestAnimationFrame(() => {
        welcomeScrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
      });
    };

    resetWelcomeScroll();
    const keyboardSubscription = Keyboard.addListener("keyboardDidHide", resetWelcomeScroll);
    return () => keyboardSubscription.remove();
  }, [step]);

  useEffect(() => {
    if (step < 1 || step > 3) return;

    requestAnimationFrame(() => {
      goalScrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    });
  }, [step]);

  const handleGenerate = async () => {
    Keyboard.dismiss();
    setStep(GENERATING_STEP);
    try {
      await onComplete({ body: bodyGoal, mind: mindGoal, craft: craftGoal, avatar });
    } catch {
      setStep(4);
    }
  };

  if (isGenerating || step === GENERATING_STEP) {
    const bob = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
    return (
      <OnboardingShell>
        <View style={styles.generatingContainer}>
          <View style={styles.loadingTrack}>
            {Array.from({ length: 7 }).map((_, index) => <View key={index} style={styles.loadingPellet} />)}
          </View>
          <Animated.View style={[styles.generatingOrb, { transform: [{ translateY: bob }, { rotate: "45deg" }] }]}>
            <Animated.View style={{ transform: [{ rotate: "-45deg" }] }}>
              <Sparkles size={31} color={Colors.light.tint} strokeWidth={2.4} />
            </Animated.View>
          </Animated.View>
          <Text style={styles.generatingTitle}>BUILDING YOUR TREE</Text>
          <Text style={styles.generatingSubtitle}>
            {isTakingLong
              ? "The quest engine is taking longer than expected. Your starter tree will load automatically."
              : "Turning your goals into playable quests..."}
          </Text>
          <View style={styles.generatingDomains}>
            {(["body", "mind", "craft"] as const).map((domain) => (
              <View key={domain} style={[styles.generatingDomain, { borderColor: DOMAIN_COLOR[domain] }]}>
                <View style={[styles.generatingDomainDot, { backgroundColor: DOMAIN_COLOR[domain] }]} />
                <Text style={[styles.generatingDomainText, { color: DOMAIN_COLOR[domain] }]}>{domain.toUpperCase()}</Text>
              </View>
            ))}
          </View>
          <ActivityIndicator color={Colors.light.tint} />
          {generateError ? <Text style={styles.errorText}>{generateError}</Text> : null}
        </View>
      </OnboardingShell>
    );
  }

  if (step === 0) {
    return (
      <OnboardingShell>
        <ScrollView
          ref={welcomeScrollRef}
          contentContainerStyle={styles.welcomeScroll}
          contentOffset={{ x: 0, y: 0 }}
          automaticallyAdjustContentInsets={false}
          automaticallyAdjustKeyboardInsets={false}
          contentInsetAdjustmentBehavior="never"
        >
          <StepDots active={0} />
          <View style={styles.arcadeMarquee}>
            <Text style={styles.insertCoin}>●  PLAYER ONE  ●</Text>
            <Text style={styles.brand}>SKILLTREE</Text>
          </View>
          <View style={styles.authHero}>
            <Text style={styles.authTitle}>BUILD YOUR{"\n"}NEXT LEVEL.</Text>
            <Text style={styles.authSub}>Choose three goals, build your player, then move through a skill tree that grows with you.</Text>
          </View>
          <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.buttonPressed]} onPress={() => setStep(1)}>
            <Text style={styles.primaryBtnText}>START GAME</Text>
            <ChevronRight size={18} color={Colors.light.background} strokeWidth={3} />
          </Pressable>
        </ScrollView>
      </OnboardingShell>
    );
  }

  if (step === 4) {
    return (
      <OnboardingShell>
        <ScrollView
          contentContainerStyle={styles.customizerScroll}
          contentOffset={{ x: 0, y: 0 }}
          automaticallyAdjustContentInsets={false}
          automaticallyAdjustKeyboardInsets={false}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="always"
        >
          <View style={styles.topRow}>
            <Pressable accessibilityLabel="Back" onPress={() => setStep(3)} style={styles.backButton}>
              <ChevronLeft size={17} color={Colors.light.text} strokeWidth={2.7} />
            </Pressable>
            <StepDots active={4} />
          </View>
          <View style={styles.questionBlock}>
            <Text style={styles.eyebrow}>CREATE YOUR PLAYER</Text>
            <Text style={styles.onboardQ}>Pick your pixel look.</Text>
            <Text style={styles.onboardHint}>Choose the look that will travel with you between skill nodes.</Text>
          </View>
          <AvatarCustomizer value={avatar} onChange={setAvatar} />
          <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.buttonPressed]} onPress={handleGenerate}>
            <Text style={styles.primaryBtnText}>ENTER THE TREE</Text>
            <Sparkles size={16} color={Colors.light.background} strokeWidth={2.8} />
          </Pressable>
        </ScrollView>
      </OnboardingShell>
    );
  }

  const currentDomain = step === 1 ? "body" : step === 2 ? "mind" : "craft";
  const currentValue = step === 1 ? bodyGoal : step === 2 ? mindGoal : craftGoal;
  const setValue = step === 1 ? setBodyGoal : step === 2 ? setMindGoal : setCraftGoal;
  const Icon = step === 1 ? Flame : step === 2 ? Wind : Hammer;

  return (
    <OnboardingShell>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.safeArea}>
        <ScrollView
          ref={goalScrollRef}
          contentContainerStyle={styles.authScroll}
          contentOffset={{ x: 0, y: 0 }}
          automaticallyAdjustContentInsets={false}
          automaticallyAdjustKeyboardInsets={false}
          contentInsetAdjustmentBehavior="never"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topRow}>
            <Pressable
              accessibilityLabel="Back"
              onPress={() => {
                if (step === 1) Keyboard.dismiss();
                setStep(step - 1);
              }}
              style={styles.backButton}
            >
              <ChevronLeft size={17} color={Colors.light.text} strokeWidth={2.7} />
            </Pressable>
            <StepDots active={step} />
          </View>
          <View style={[styles.domainBadge, { borderColor: DOMAIN_COLOR[currentDomain] }]}>
            <Icon size={14} color={DOMAIN_COLOR[currentDomain]} strokeWidth={2.5} />
            <Text style={[styles.domainBadgeText, { color: DOMAIN_COLOR[currentDomain] }]}>{currentDomain.toUpperCase()} QUEST</Text>
          </View>
          <View style={styles.questionBlock}>
            <Text style={styles.onboardQ}>
              {step === 1 ? "What are your physical goals?" : step === 2 ? "What are your mental goals?" : "What skills do you want to build?"}
            </Text>
            <Text style={styles.onboardHint}>
              {step === 1 ? "Strength, fitness, energy, movement..." : step === 2 ? "Focus, calm, sleep, confidence..." : "Coding, writing, business, language..."}
            </Text>
          </View>
          <TextInput
            style={styles.onboardInput}
            value={currentValue}
            onChangeText={setValue}
            placeholder="TYPE YOUR QUEST HERE..."
            placeholderTextColor="#62698D"
            multiline
            numberOfLines={4}
          />
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, currentValue.trim().length < 10 && styles.primaryBtnDisabled, pressed && styles.buttonPressed]}
            onPress={() => {
              if (step === 3) Keyboard.dismiss();
              setStep(step + 1);
            }}
            disabled={currentValue.trim().length < 10}
          >
            <Text style={styles.primaryBtnText}>{step === 3 ? "BUILD YOUR PLAYER" : "NEXT QUEST"}</Text>
            <ChevronRight size={18} color={Colors.light.background} strokeWidth={3} />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: Colors.light.background },
  safeArea: { flex: 1 },
  mazeRail: { position: "absolute", backgroundColor: Colors.light.arcadeBlue, opacity: 0.4 },
  mazeRailTop: { top: 24, left: 18, right: 72, height: 3 },
  mazeRailBottom: { bottom: 28, left: 72, right: 18, height: 3 },
  mazeRailLeft: { top: 24, bottom: "64%", left: 18, width: 3 },
  mazeRailRight: { top: "62%", bottom: 28, right: 18, width: 3 },
  pelletRow: { position: "absolute", top: 42, left: 38, right: 38, flexDirection: "row", justifyContent: "space-between", opacity: 0.32 },
  pelletRowBottom: { top: undefined, bottom: 46 },
  pellet: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.light.pellet },
  welcomeScroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, gap: 24, flexGrow: 1 },
  authScroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, gap: 24, flexGrow: 1 },
  customizerScroll: { padding: 24, paddingTop: 38, paddingBottom: 72, gap: 24 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  backButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: Colors.light.border, backgroundColor: Colors.light.surfaceDeep },
  stepIndicator: { flex: 1, flexDirection: "row", gap: 7 },
  stepDot: { height: 6, flex: 1, backgroundColor: Colors.light.surfaceDeep, borderWidth: 1, borderColor: Colors.light.border },
  stepDotComplete: { backgroundColor: Colors.light.arcadeBlue },
  stepDotActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  arcadeMarquee: { alignSelf: "flex-start", borderWidth: 2, borderColor: Colors.light.arcadeBlue, backgroundColor: Colors.light.surfaceDeep, paddingHorizontal: 15, paddingVertical: 11, gap: 4 },
  insertCoin: { fontFamily: "monospace", fontSize: 9, color: Colors.light.tint, letterSpacing: 1.8, fontWeight: "900" },
  brand: { fontFamily: "monospace", fontSize: 12, color: Colors.light.text, letterSpacing: 4, fontWeight: "900" },
  authHero: { gap: 14 },
  authTitle: { fontFamily: "monospace", fontSize: 38, fontWeight: "900", color: Colors.light.text, lineHeight: 45, letterSpacing: -1 },
  authSub: { fontSize: 15, color: Colors.light.muted, lineHeight: 23 },
  questionBlock: { gap: 10 },
  eyebrow: { fontFamily: "monospace", fontSize: 10, letterSpacing: 2, color: Colors.light.tint, fontWeight: "900" },
  onboardQ: { fontSize: 30, fontWeight: "900", color: Colors.light.text, lineHeight: 37 },
  onboardHint: { fontSize: 14, color: Colors.light.muted, lineHeight: 21 },
  domainBadge: { flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start", paddingHorizontal: 11, paddingVertical: 7, backgroundColor: Colors.light.surfaceDeep, borderWidth: 2 },
  domainBadgeText: { fontFamily: "monospace", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  onboardInput: { minHeight: 132, paddingHorizontal: 17, paddingVertical: 16, backgroundColor: Colors.light.surfaceDeep, borderWidth: 2, borderColor: Colors.light.arcadeBlue, fontSize: 16, lineHeight: 24, color: Colors.light.text, textAlignVertical: "top" },
  primaryBtn: { minHeight: 56, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: Colors.light.tint, borderWidth: 3, borderColor: "#FFF3A3", shadowColor: Colors.light.tint, shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  primaryBtnDisabled: { opacity: 0.34 },
  primaryBtnText: { fontFamily: "monospace", fontSize: 14, fontWeight: "900", letterSpacing: 1, color: Colors.light.background },
  buttonPressed: { opacity: 0.78, transform: [{ translateY: 2 }] },
  generatingContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 36, gap: 18 },
  loadingTrack: { width: 210, flexDirection: "row", justifyContent: "space-between", marginBottom: 22 },
  loadingPellet: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.light.tint },
  generatingOrb: { width: 88, height: 88, alignItems: "center", justifyContent: "center", backgroundColor: Colors.light.surfaceDeep, borderWidth: 3, borderColor: Colors.light.arcadeBlue },
  generatingTitle: { fontFamily: "monospace", fontSize: 22, fontWeight: "900", letterSpacing: 1.2, color: Colors.light.text, textAlign: "center" },
  generatingSubtitle: { fontSize: 14, color: Colors.light.muted, textAlign: "center", lineHeight: 22 },
  generatingDomains: { flexDirection: "row", gap: 8 },
  generatingDomain: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 2, backgroundColor: Colors.light.surfaceDeep },
  generatingDomainDot: { width: 6, height: 6 },
  generatingDomainText: { fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  errorText: { fontSize: 13, color: Colors.light.error, textAlign: "center", marginTop: 8 },
});
