import React, { useState, useRef, useEffect } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { ChevronRight, Flame, Hammer, Sparkles, Wind } from "lucide-react-native";
import Colors from "@/constants/colors";
import { DOMAIN_COLOR } from "@/mocks/mvp-data";
import type { OnboardingAnswers } from "@/state/app-state";

type Props = {
  onComplete: (answers: OnboardingAnswers) => Promise<void>; // Updated to Promise
  isGenerating: boolean;
  generateError: string | null;
};

export function OnboardingScreens({ onComplete, isGenerating, generateError }: Props) {
  const [step, setStep] = useState<number>(0);
  const [bodyGoal, setBodyGoal] = useState<string>("");
  const [mindGoal, setMindGoal] = useState<string>("");
  const [craftGoal, setCraftGoal] = useState<string>("");

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (isGenerating) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => animation?.stop();
  }, [isGenerating]);

  // Handle the final generation trigger
  const handleGenerate = async () => {
    // 1. Move to the generating UI immediately
    setStep(4);
    try {
      // 2. Wait for the actual AI response before the parent switches screens
      await onComplete({ body: bodyGoal, mind: mindGoal, craft: craftGoal });
    } catch (e) {
      // 3. If it fails, kick back to step 3 so they can try again
      setStep(3);
    }
  };

  const StepDots = ({ active }: { active: number }) => (
    <View style={styles.stepIndicator}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[styles.stepDot, i === active && styles.stepDotActive]} />
      ))}
    </View>
  );

  // Loading / Generating State
  if (isGenerating || step === 4) {
    return (
      <View style={styles.shell}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.generatingContainer}>
            <Animated.View style={[styles.generatingOrb, { transform: [{ scale: pulseAnim }] }]}>
              <Sparkles size={32} color={Colors.light.tint} strokeWidth={1.5} />
            </Animated.View>
            <Text style={styles.generatingTitle}>Building your tree...</Text>
            <Text style={styles.generatingSubtitle}>
              AI is crafting personalized challenges across{"\n"}Mind, Body & Craft
            </Text>
            <View style={styles.generatingDomains}>
              {(["body", "mind", "craft"] as const).map((d) => (
                <View key={d} style={[styles.generatingDomain, { borderColor: `${DOMAIN_COLOR[d]}40` }]}>
                  <View style={[styles.generatingDomainDot, { backgroundColor: DOMAIN_COLOR[d] }]} />
                  <Text style={[styles.generatingDomainText, { color: DOMAIN_COLOR[d] }]}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </Text>
                </View>
              ))}
            </View>
            {generateError && <Text style={styles.errorText}>{generateError}</Text>}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Step 0: Welcome
  if (step === 0) {
    return (
      <View style={styles.shell}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.authScroll}>
            <StepDots active={0} />
            <View style={styles.authHero}>
              <Text style={styles.brand}>ARCSTEP</Text>
              <Text style={styles.authTitle}>Let's build{"\n"}your tree.</Text>
              <Text style={styles.authSub}>Answer 3 quick questions and AI will generate a personalized challenge tree just for you.</Text>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep(1)}>
              <Text style={styles.primaryBtnText}>Let's Go</Text>
              <ChevronRight size={18} color="#060810" strokeWidth={2.5} />
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // Steps 1-3: Data Entry
  const currentDomain = step === 1 ? "body" : step === 2 ? "mind" : "craft";
  const currentVal = step === 1 ? bodyGoal : step === 2 ? mindGoal : craftGoal;
  const setFunc = step === 1 ? setBodyGoal : step === 2 ? setMindGoal : setCraftGoal;
  const Icon = step === 1 ? Flame : step === 2 ? Wind : Hammer;

  return (
    <View style={styles.shell}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
            <StepDots active={step} />
            <View style={[styles.domainBadge, { backgroundColor: `${DOMAIN_COLOR[currentDomain]}18`, borderColor: `${DOMAIN_COLOR[currentDomain]}40` }]}>
              <Icon size={14} color={DOMAIN_COLOR[currentDomain]} strokeWidth={2} />
              <Text style={[styles.domainBadgeText, { color: DOMAIN_COLOR[currentDomain] }]}>
                {currentDomain.charAt(0).toUpperCase() + currentDomain.slice(1)}
              </Text>
            </View>
            <Text style={styles.onboardQ}>
              {step === 1 ? "What are your physical goals?" : step === 2 ? "What are your mental goals?" : "What skills do you want to build?"}
            </Text>
            <Text style={styles.onboardHint}>
              {step === 1 ? "Think: weight, strength, fitness, energy..." : step === 2 ? "Think: focus, stress, sleep, productivity..." : "Think: coding, writing, business, language..."}
            </Text>
            <TextInput
              style={styles.onboardInput}
              value={currentVal}
              onChangeText={setFunc}
              placeholder="Be specific for better AI results..."
              placeholderTextColor="#2A3560"
              multiline
              numberOfLines={4}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.primaryBtn, currentVal.trim().length < 10 && styles.primaryBtnDisabled]}
              onPress={step === 3 ? handleGenerate : () => setStep(step + 1)}
              disabled={currentVal.trim().length < 10}
            >
              <Text style={styles.primaryBtnText}>{step === 3 ? "Generate My Tree" : "Next"}</Text>
              {step === 3 ? <Sparkles size={16} color="#060810" strokeWidth={2} /> : <ChevronRight size={18} color="#060810" strokeWidth={2.5} />}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#060810" },
  safeArea: { flex: 1 },
  authScroll: { padding: 24, paddingTop: 52, gap: 28, flexGrow: 1 },
  authHero: { gap: 12 },
  brand: { fontSize: 11, letterSpacing: 3.5, color: Colors.light.tint, fontWeight: "700", textTransform: "uppercase" },
  authTitle: { fontSize: 40, fontWeight: "800", color: Colors.light.text, lineHeight: 46 },
  authSub: { fontSize: 15, color: Colors.light.muted, lineHeight: 24 },
  primaryBtn: { 
    backgroundColor: Colors.light.tint, 
    borderRadius: 16, 
    paddingVertical: 16, 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    gap: 8, 
    elevation: 4,
    shadowColor: Colors.light.tint, 
    shadowOpacity: 0.3, 
    shadowRadius: 16, 
    shadowOffset: { width: 0, height: 4 } 
  },
  primaryBtnDisabled: { opacity: 0.35 },
  primaryBtnText: { fontSize: 16, fontWeight: "800", color: "#060810", letterSpacing: 0.3 },
  stepIndicator: { flexDirection: "row", gap: 6, marginBottom: 8 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#1A2238" },
  stepDotActive: { backgroundColor: Colors.light.tint, width: 24 },
  domainBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  domainBadgeText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  onboardQ: { fontSize: 30, fontWeight: "800", color: Colors.light.text, lineHeight: 38 },
  onboardHint: { fontSize: 14, color: Colors.light.muted, lineHeight: 22 },
  onboardInput: { backgroundColor: "#0C1120", borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16, fontSize: 16, color: Colors.light.text, borderWidth: 1, borderColor: "#1A2238", lineHeight: 24, minHeight: 120, textAlignVertical: "top" },
  errorText: { fontSize: 13, color: "#FF6A4D", textAlign: "center", marginTop: 10 },
  generatingContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 20 },
  generatingOrb: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    backgroundColor: "#0C1120", // Solid background for Android
    borderWidth: 1, 
    borderColor: `${Colors.light.tint}40`, 
    alignItems: "center", 
    justifyContent: "center",
    elevation: 12, // Shadow for Android
    shadowColor: Colors.light.tint, // Shadow for iOS
    shadowOpacity: 0.5,
    shadowRadius: 20,
    overflow: "hidden" // Clip the dark polygon bug
  },
  generatingTitle: { fontSize: 26, fontWeight: "800", color: Colors.light.text, textAlign: "center" },
  generatingSubtitle: { fontSize: 15, color: Colors.light.muted, textAlign: "center", lineHeight: 24 },
  generatingDomains: { flexDirection: "row", gap: 10 },
  generatingDomain: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, backgroundColor: "#0A0D18" },
  generatingDomainDot: { width: 6, height: 6, borderRadius: 3 },
  generatingDomainText: { fontSize: 13, fontWeight: "700" },
});