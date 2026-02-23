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
} from "react-native";
import Constants from "expo-constants";
import {
  Check,
  Crown,
  Shield,
  X,
  Zap,
} from "lucide-react-native";
import { useMutation } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useAppState } from "@/state/app-state";
import { trpc } from "@/lib/trpc";
import { useStripePayment } from "@/lib/stripe";

type Props = {
  visible: boolean;
  onClose: () => void;
};

const PERKS = [
  { icon: Zap, color: "#FFD700", text: "1.5× XP on every challenge & reward" },
  { icon: Shield, color: "#3DFF8E", text: "Completely ad-free experience" },
  { icon: Crown, color: "#A78BFA", text: "Priority challenge personalization" },
];

export function ProUpgradeModal({ visible, onClose }: Props) {
  const { state, setPro } = useAppState();
  const { initPaymentSheet, presentPaymentSheet } = useStripePayment();
  const [successVisible, setSuccessVisible] = useState<boolean>(false);
  const isExpoGo = Constants.appOwnership === "expo";

  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const crownAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      setSuccessVisible(false);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 70, friction: 12 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(crownAnim, { toValue: 1.12, duration: 800, useNativeDriver: true }),
          Animated.timing(crownAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      scaleAnim.setValue(0.88);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim, crownAnim]);

  const createIntentMutation = trpc.social.createSubscriptionIntent.useMutation();

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (isExpoGo) {
        throw new Error(
          "Stripe payments are not supported in Expo Go. Use an EAS development build or a release build to test Pro checkout."
        );
      }

      console.log("[pro] Initiating £5.99/mo subscription");
      const { clientSecret } = await createIntentMutation.mutateAsync({
        userId: state.userId,
      });
      await initPaymentSheet({
        clientSecret,
        merchantDisplayName: "SkillTree",
      });
      const result = await presentPaymentSheet();
      if (result.error) {
        throw new Error(result.error.message);
      }
    },
    onSuccess: () => {
      console.log("[pro] Subscription successful — activating Pro");
      setSuccessVisible(true);
      setTimeout(() => {
        setPro(true);
        onClose();
      }, 1800);
    },
    onError: (err) => {
      console.error("[pro] Subscription error:", err);
      Alert.alert("Unable to start checkout", err.message);
    },
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.centeredView} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          {successVisible ? (
            <View style={styles.successContainer}>
              <View style={styles.successOrb}>
                <Check size={36} color="#FFD700" strokeWidth={2.5} />
              </View>
              <Text style={styles.successTitle}>You're Pro!</Text>
              <Text style={styles.successSub}>1.5× XP is now active. Enjoy the journey.</Text>
            </View>
          ) : (
            <>
              <Pressable style={styles.closeBtn} onPress={onClose} testID="pro-modal-close">
                <X size={14} color={Colors.light.muted} strokeWidth={2} />
              </Pressable>

              <View style={styles.topSection}>
                <Animated.View style={[styles.crownOrb, { transform: [{ scale: crownAnim }] }]}>
                  <Crown size={30} color="#FFD700" strokeWidth={1.8} />
                </Animated.View>
                <Text style={styles.title}>SkillTree Pro</Text>
                <Text style={styles.subtitle}>Unlock your full potential</Text>
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.priceAmount}>£5.99</Text>
                <View>
                  <Text style={styles.pricePeriod}>/ month</Text>
                  <Text style={styles.priceCancel}>Cancel anytime</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.perksSection}>
                {PERKS.map(({ icon: Icon, color, text }) => (
                  <View key={text} style={styles.perkRow}>
                    <View style={[styles.perkIconWrap, { backgroundColor: `${color}18`, borderColor: `${color}30` }]}>
                      <Icon size={14} color={color} strokeWidth={2} />
                    </View>
                    <Text style={styles.perkText}>{text}</Text>
                  </View>
                ))}
              </View>

              {subscribeMutation.isError && (
                <Text style={styles.errorText}>Payment failed. Please try again.</Text>
              )}

              <TouchableOpacity
                style={[styles.subscribeBtn, subscribeMutation.isPending && styles.subscribeBtnDisabled]}
                onPress={() => subscribeMutation.mutate()}
                disabled={subscribeMutation.isPending}
                testID="subscribe-btn"
              >
                {subscribeMutation.isPending ? (
                  <Text style={styles.subscribeBtnText}>Processing...</Text>
                ) : (
                  <>
                    <Crown size={16} color="#060810" strokeWidth={2.5} />
                    <Text style={styles.subscribeBtnText}>Subscribe for £5.99/mo</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.legal}>
                Billed monthly. Secure payment via Stripe.
              </Text>
              {isExpoGo && (
                <Text style={styles.errorText}>
                  Stripe checkout cannot run inside Expo Go. Use a development build to test Pro.
                </Text>
              )}
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  centeredView: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  card: {
    width: "100%",
    backgroundColor: "#0C1120",
    borderRadius: 30,
    padding: 28,
    borderWidth: 1.5,
    borderColor: "#FFD70030",
    shadowColor: "#FFD700",
    shadowOpacity: 0.15,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
    gap: 20,
  },
  closeBtn: {
    position: "absolute",
    top: 18,
    right: 18,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#111828",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  topSection: {
    alignItems: "center",
    gap: 8,
    paddingTop: 8,
  },
  crownOrb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FFD70012",
    borderWidth: 1.5,
    borderColor: "#FFD70040",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FFD700",
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: Colors.light.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.muted,
    fontWeight: "500",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  priceAmount: {
    fontSize: 48,
    fontWeight: "900",
    color: "#FFD700",
    lineHeight: 52,
  },
  pricePeriod: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
  },
  priceCancel: {
    fontSize: 11,
    color: Colors.light.muted,
    fontWeight: "500",
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "#1A2238",
  },
  perksSection: {
    gap: 12,
  },
  perkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  perkIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    flexShrink: 0,
  },
  perkText: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: "500",
    flex: 1,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 13,
    color: "#FF6A4D",
    textAlign: "center",
    fontWeight: "600",
  },
  subscribeBtn: {
    backgroundColor: "#FFD700",
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#FFD700",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  subscribeBtnDisabled: {
    opacity: 0.6,
  },
  subscribeBtnText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#060810",
    letterSpacing: 0.2,
  },
  legal: {
    fontSize: 11,
    color: "#2A3560",
    textAlign: "center",
    fontWeight: "500",
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 14,
  },
  successOrb: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFD70012",
    borderWidth: 1.5,
    borderColor: "#FFD70050",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFD700",
  },
  successSub: {
    fontSize: 14,
    color: Colors.light.muted,
    textAlign: "center",
    fontWeight: "500",
    lineHeight: 22,
  },
});
