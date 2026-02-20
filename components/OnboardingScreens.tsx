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
} from "react-native";
import { ChevronRight, Flame, Hammer, Sparkles, Wind } from "lucide-react-native";
import Colors from "@/constants/colors";
import { DOMAIN_COLOR } from "@/mocks/mvp-data";
import type { OnboardingAnswers } from "@/state/app-state";

type Props = {
  onComplete: (answers: OnboardingAnswers) => void;
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
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    if (isGenerating) loop.start();
    else loop.stop();
    return () => loop.stop();
  }, [isGenerating, pulseAnim]);

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
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const StepDots = ({ active }: { active: number }) => (
    <View style={styles.stepIndicator}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[styles.stepDot, i === active && styles.stepDotActive]} />
      ))}
    </View>
  );

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
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep(1)} testID="onboard-start">
              <Text style={styles.primaryBtnText}>Let's Go</Text>
              <ChevronRight size={18} color="#060810" strokeWidth={2.5} />
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  if (step === 1) {
    return (
      <View style={styles.shell}>
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
              <StepDots active={1} />
              <View style={[styles.domainBadge, { backgroundColor: `${DOMAIN_COLOR.body}18`, borderColor: `${DOMAIN_COLOR.body}40` }]}>
                <Flame size={14} color={DOMAIN_COLOR.body} strokeWidth={2} />
                <Text style={[styles.domainBadgeText, { color: DOMAIN_COLOR.body }]}>Body</Text>
              </View>
              <Text style={styles.onboardQ}>What are your physical goals?</Text>
              <Text style={styles.onboardHint}>Think: weight, strength, fitness level, energy, sports...</Text>
              <TextInput
                style={styles.onboardInput}
                value={bodyGoal}
                onChangeText={setBodyGoal}
                placeholder="e.g. I want to lose 15kg and run a 5K without stopping"
                placeholderTextColor="#2A3560"
                multiline
                numberOfLines={4}
                autoFocus
                testID="body-goal"
              />
              <TouchableOpacity
                style={[styles.primaryBtn, bodyGoal.trim().length < 10 && styles.primaryBtnDisabled]}
                onPress={() => setStep(2)}
                disabled={bodyGoal.trim().length < 10}
              >
                <Text style={styles.primaryBtnText}>Next</Text>
                <ChevronRight size={18} color="#060810" strokeWidth={2.5} />
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  if (step === 2) {
    return (
      <View style={styles.shell}>
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
              <StepDots active={2} />
              <View style={[styles.domainBadge, { backgroundColor: `${DOMAIN_COLOR.mind}18`, borderColor: `${DOMAIN_COLOR.mind}40` }]}>
                <Wind size={14} color={DOMAIN_COLOR.mind} strokeWidth={2} />
                <Text style={[styles.domainBadgeText, { color: DOMAIN_COLOR.mind }]}>Mind</Text>
              </View>
              <Text style={styles.onboardQ}>What are your mental goals?</Text>
              <Text style={styles.onboardHint}>Think: focus, stress, sleep, mindset, productivity, mental health...</Text>
              <TextInput
                style={styles.onboardInput}
                value={mindGoal}
                onChangeText={setMindGoal}
                placeholder="e.g. I want to stop overthinking and focus deeply for 2 hours a day"
                placeholderTextColor="#2A3560"
                multiline
                numberOfLines={4}
                autoFocus
                testID="mind-goal"
              />
              <TouchableOpacity
                style={[styles.primaryBtn, mindGoal.trim().length < 10 && styles.primaryBtnDisabled]}
                onPress={() => setStep(3)}
                disabled={mindGoal.trim().length < 10}
              >
                <Text style={styles.primaryBtnText}>Next</Text>
                <ChevronRight size={18} color="#060810" strokeWidth={2.5} />
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
            <StepDots active={3} />
            <View style={[styles.domainBadge, { backgroundColor: `${DOMAIN_COLOR.craft}18`, borderColor: `${DOMAIN_COLOR.craft}40` }]}>
              <Hammer size={14} color={DOMAIN_COLOR.craft} strokeWidth={2} />
              <Text style={[styles.domainBadgeText, { color: DOMAIN_COLOR.craft }]}>Craft</Text>
            </View>
            <Text style={styles.onboardQ}>What skills do you want to build?</Text>
            <Text style={styles.onboardHint}>Think: coding, writing, music, business, design, language...</Text>
            <TextInput
              style={styles.onboardInput}
              value={craftGoal}
              onChangeText={setCraftGoal}
              placeholder="e.g. I want to learn to code and build my own app in 6 months"
              placeholderTextColor="#2A3560"
              multiline
              numberOfLines={4}
              autoFocus
              testID="craft-goal"
            />
            {generateError && (
              <Text style={styles.errorText}>{generateError}</Text>
            )}
            <TouchableOpacity
              style={[styles.primaryBtn, craftGoal.trim().length < 10 && styles.primaryBtnDisabled]}
              onPress={() => {
                setStep(4);
                onComplete({ body: bodyGoal, mind: mindGoal, craft: craftGoal });
              }}
              disabled={craftGoal.trim().length < 10}
            >
              <Text style={styles.primaryBtnText}>Generate My Tree</Text>
              <Sparkles size={16} color="#060810" strokeWidth={2} />
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
  primaryBtn: { backgroundColor: Colors.light.tint, borderRadius: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: Colors.light.tint, shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
  primaryBtnDisabled: { opacity: 0.35 },
  primaryBtnText: { fontSize: 16, fontWeight: "800", color: "#060810", letterSpacing: 0.3 },
  stepIndicator: { flexDirection: "row", gap: 6, marginBottom: 8 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#1A2238" },
  stepDotActive: { backgroundColor: Colors.light.tint, width: 24 },
  domainBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  domainBadgeText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  onboardQ: { fontSize: 30, fontWeight: "800", color: Colors.light.text, lineHeight: 38 },
  onboardHint: { fontSize: 14, color: Colors.light.muted, lineHeight: 22 },
  onboardInput: { backgroundColor: "#0C1120", borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16, fontSize: 16, color: Colors.light.text, borderWidth: 1, borderColor: "#1A2238", lineHeight: 24, minHeight: 100, textAlignVertical: "top" },
  errorText: { fontSize: 13, color: "#FF6A4D", textAlign: "center" },
  generatingContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 20 },
  generatingOrb: { width: 100, height: 100, borderRadius: 50, backgroundColor: `${Colors.light.tint}15`, borderWidth: 1, borderColor: `${Colors.light.tint}40`, alignItems: "center", justifyContent: "center" },
  generatingTitle: { fontSize: 26, fontWeight: "800", color: Colors.light.text, textAlign: "center" },
  generatingSubtitle: { fontSize: 15, color: Colors.light.muted, textAlign: "center", lineHeight: 24 },
  generatingDomains: { flexDirection: "row", gap: 10 },
  generatingDomain: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, backgroundColor: "#0A0D18" },
  generatingDomainDot: { width: 6, height: 6, borderRadius: 3 },
  generatingDomainText: { fontSize: 13, fontWeight: "700" },
});
