import React, { useRef, useEffect, useState } from "react";
import {
  Animated,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import Constants from "expo-constants";
import { Check, Crown, Shield, X, Zap } from "lucide-react-native";
import Colors from "@/constants/colors";
import { useAppState } from "@/state/app-state";
import { trpc } from "@/lib/trpc";
import { useStripe } from "@stripe/stripe-react-native";

type Props = {
  visible: boolean;
  onClose: () => void;
};

const PERKS = [
  { icon: Zap, color: "#FFD700", text: "1.5× XP on every challenge & reward" },
  { icon: Shield, color: "#3DFF8E", text: "Completely ad-free experience" },
  { icon: Crown, color: "#A78BFA", text: "Priority AI challenge personalization" },
];

export function ProUpgradeModal({ visible, onClose }: Props) {
  const { state, setPro } = useAppState();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [isProcessing, setIsProcessing] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  
  // 🔥 FIX 2: Store the intent so we don't spam the backend on re-clicks
  const [activeClientSecret, setActiveClientSecret] = useState<string | null>(null);

  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const crownAnim = useRef(new Animated.Value(1)).current;

  const createIntent = trpc.social.createSubscriptionIntent.useMutation();

  useEffect(() => {
    if (visible) {
      setSuccessVisible(false);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
      
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(crownAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
          Animated.timing(crownAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      // Reset state when hiding so it's fresh next time
      setActiveClientSecret(null);
    }
  }, [visible]);

  // 🔥 FIX 1: Smooth Exit Animation
  const handleClose = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 200, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      onClose(); // Actually unmount the modal after the animation finishes
    });
  };

  const handleSubscribe = async () => {
    if (Constants.appOwnership === "expo") {
      return Alert.alert("Expo Go Limited", "Stripe requires a development build (APK) to test payments.");
    }

    setIsProcessing(true);
    try {
      let secretToUse = activeClientSecret;

      // Only fetch a new intent from backend if we don't already have one ready
      if (!secretToUse) {
        const { clientSecret, customer } = await createIntent.mutateAsync({ userId: state.userId });
        secretToUse = clientSecret;
        setActiveClientSecret(clientSecret);

        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: "SkillTree",
          paymentIntentClientSecret: clientSecret,
          customerId: customer,
          allowsDelayedPaymentMethods: true,
          appearance: {
            colors: { primary: "#FFD700" },
            shapes: { borderRadius: 16 },
          },
        });

        if (initError) throw new Error(initError.message);
      }

      // Show Sheet
      const { error: presentError } = await presentPaymentSheet();
      
      if (presentError) {
        // User cancelled or card failed. We don't throw, we just let them try again.
        if (presentError.code !== "Canceled") {
           throw new Error(presentError.message);
        }
        return; // Exit silently if they just closed the sheet
      }

      // Handle Success
      setSuccessVisible(true);
      setTimeout(() => {
        setPro(true);
        handleClose(); // Use the smooth close here
      }, 2000);
      
    } catch (err: any) {
      Alert.alert("Payment Error", err.message || "An unexpected error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <View style={styles.centeredView} pointerEvents="box-none">
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
          {successVisible ? (
            <View style={styles.successContainer}>
              <View style={styles.successOrb}><Check size={36} color="#FFD700" strokeWidth={3} /></View>
              <Text style={styles.successTitle}>You're Pro!</Text>
              <Text style={styles.successSub}>1.5× XP is now active. Enjoy your journey.</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity style={styles.closeBtn} onPress={handleClose}><X size={16} color={Colors.light.muted} /></TouchableOpacity>
              
              <View style={styles.topSection}>
                <Animated.View style={[styles.crownOrb, { transform: [{ scale: crownAnim }] }]}>
                  <Crown size={32} color="#FFD700" strokeWidth={2} />
                </Animated.View>
                <Text style={styles.title}>SkillTree Pro</Text>
                <Text style={styles.subtitle}>Unlock your full potential</Text>
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.priceAmount}>£5.99</Text>
                <View><Text style={styles.pricePeriod}>/ month</Text><Text style={styles.priceCancel}>Cancel anytime</Text></View>
              </View>

              <View style={styles.perksSection}>
                {PERKS.map(({ icon: Icon, color, text }) => (
                  <View key={text} style={styles.perkRow}>
                    <View style={[styles.perkIconWrap, { backgroundColor: `${color}15`, borderColor: `${color}30` }]}><Icon size={14} color={color} /></View>
                    <Text style={styles.perkText}>{text}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity 
                style={[styles.subscribeBtn, isProcessing && styles.disabledBtn]} 
                onPress={handleSubscribe} 
                disabled={isProcessing}
              >
                {isProcessing ? <ActivityIndicator color="#060810" /> : (
                  <>
                    <Crown size={18} color="#060810" strokeWidth={2.5} />
                    <Text style={styles.subscribeBtnText}>Subscribe Now</Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.legal}>Billed monthly. Secure payment via Stripe.</Text>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ... keep all your existing styles exactly as they were ...
const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.8)" },
  centeredView: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  card: { 
    width: "100%", 
    backgroundColor: "#0C1120", 
    borderRadius: 32, 
    padding: 24, 
    borderWidth: 1.5, 
    borderColor: "#FFD70025", 
    elevation: 20, 
    overflow: "hidden", 
    gap: 20 
  },
  closeBtn: { position: "absolute", top: 20, right: 20, padding: 8, zIndex: 10 },
  topSection: { alignItems: "center", gap: 10 },
  crownOrb: { 
    width: 80, height: 80, borderRadius: 40, 
    backgroundColor: "#111828", 
    borderWidth: 1.5, borderColor: "#FFD70040", 
    alignItems: "center", justifyContent: "center",
    elevation: 10 
  },
  title: { fontSize: 28, fontWeight: "900", color: "#FFF" },
  subtitle: { fontSize: 14, color: Colors.light.muted },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  priceAmount: { fontSize: 48, fontWeight: "900", color: "#FFD700" },
  pricePeriod: { fontSize: 16, fontWeight: "700", color: "#FFF" },
  priceCancel: { fontSize: 11, color: Colors.light.muted },
  perksSection: { gap: 14, marginVertical: 10 },
  perkRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  perkIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  perkText: { fontSize: 14, color: "#E2E8F0", flex: 1, lineHeight: 20 },
  subscribeBtn: { 
    backgroundColor: "#FFD700", borderRadius: 18, paddingVertical: 16, 
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    elevation: 8 
  },
  disabledBtn: { opacity: 0.6 },
  subscribeBtnText: { fontSize: 16, fontWeight: "900", color: "#060810" },
  legal: { fontSize: 11, color: "#475569", textAlign: "center" },
  successContainer: { alignItems: "center", paddingVertical: 30, gap: 16 },
  successOrb: { width: 88, height: 88, borderRadius: 44, backgroundColor: "#111828", borderWidth: 2, borderColor: "#FFD70050", alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: 32, fontWeight: "900", color: "#FFD700" },
  successSub: { fontSize: 15, color: Colors.light.muted, textAlign: "center", lineHeight: 22 },
});