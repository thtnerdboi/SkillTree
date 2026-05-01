import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Check, Crown, RefreshCcw, Shield, Sparkles, X, Zap } from "lucide-react-native";

import Colors from "@/constants/colors";
import {
  REVENUECAT_PRO_DISPLAY_NAME,
  useRevenueCat,
} from "@/lib/revenuecat";

type Props = {
  visible: boolean;
  onClose: () => void;
};

const PERKS = [
  { icon: Zap, color: "#FFD700", text: "1.5x XP on every challenge and reward" },
  { icon: Shield, color: "#3DFF8E", text: "Completely ad-free experience" },
  { icon: Crown, color: "#A78BFA", text: "Priority AI challenge personalization" },
];

export function ProUpgradeModal({ visible, onClose }: Props) {
  const {
    isLoading,
    isPurchasing,
    isPro,
    monthlyPackage,
    yearlyPackage,
    error,
    purchaseMonthly,
    purchaseYearly,
    restorePurchases,
    presentProPaywall,
  } = useRevenueCat();

  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [opacityAnim, scaleAnim, visible]);

  useEffect(() => {
    if (visible && isPro) {
      const timeout = setTimeout(onClose, 900);
      return () => clearTimeout(timeout);
    }
  }, [isPro, onClose, visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 160, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(onClose);
  };

  if (!visible) return null;

  const monthlyPrice = monthlyPackage?.product.priceString ?? "Monthly";
  const yearlyPrice = yearlyPackage?.product.priceString ?? "Yearly";

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <View style={styles.centeredView} pointerEvents="box-none">
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose} testID="close-pro-modal">
            <X size={16} color={Colors.light.muted} />
          </TouchableOpacity>

          {isPro ? (
            <View style={styles.successContainer}>
              <View style={styles.successOrb}>
                <Check size={36} color="#FFD700" strokeWidth={3} />
              </View>
              <Text style={styles.successTitle}>Pro Active</Text>
              <Text style={styles.successSub}>{REVENUECAT_PRO_DISPLAY_NAME} is unlocked.</Text>
            </View>
          ) : (
            <>
              <View style={styles.topSection}>
                <View style={styles.crownOrb}>
                  <Crown size={32} color="#FFD700" strokeWidth={2.5} />
                </View>
                <Text style={styles.title}>SkillTree Pro</Text>
                <Text style={styles.subtitle}>Unlock your full potential</Text>
              </View>

              <View style={styles.perksSection}>
                {PERKS.map(({ icon: Icon, color, text }) => (
                  <View key={text} style={styles.perkRow}>
                    <View style={[styles.perkIconWrap, { backgroundColor: `${color}15`, borderColor: `${color}30` }]}>
                      <Icon size={14} color={color} />
                    </View>
                    <Text style={styles.perkText}>{text}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.paywallBtn, (isLoading || isPurchasing) && styles.disabledBtn]}
                onPress={presentProPaywall}
                disabled={isLoading || isPurchasing}
                testID="show-revenuecat-paywall"
              >
                {isPurchasing ? (
                  <ActivityIndicator color="#060810" />
                ) : (
                  <>
                    <Sparkles size={17} color="#060810" strokeWidth={2.5} />
                    <Text style={styles.paywallBtnText}>View Paywall</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.planRow}>
                <TouchableOpacity
                  style={[styles.planBtn, (!monthlyPackage || isPurchasing) && styles.disabledPlan]}
                  onPress={purchaseMonthly}
                  disabled={!monthlyPackage || isPurchasing}
                  testID="purchase-monthly"
                >
                  <Text style={styles.planLabel}>Monthly</Text>
                  <Text style={styles.planPrice}>{monthlyPrice}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.planBtn, styles.featuredPlan, (!yearlyPackage || isPurchasing) && styles.disabledPlan]}
                  onPress={purchaseYearly}
                  disabled={!yearlyPackage || isPurchasing}
                  testID="purchase-yearly"
                >
                  <Text style={styles.planLabel}>Yearly</Text>
                  <Text style={styles.planPrice}>{yearlyPrice}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.restoreBtn}
                onPress={restorePurchases}
                disabled={isPurchasing}
                testID="restore-purchases"
              >
                <RefreshCcw size={14} color={Colors.light.tint} strokeWidth={2.5} />
                <Text style={styles.restoreText}>Restore purchases</Text>
              </TouchableOpacity>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Text style={styles.legal}>Subscriptions are handled securely by RevenueCat and the app stores.</Text>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.8)" },
  centeredView: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  card: {
    width: "100%",
    backgroundColor: "#0C1120",
    borderRadius: 28,
    padding: 24,
    borderWidth: 1.5,
    borderColor: "#FFD70025",
    elevation: 20,
    gap: 18,
  },
  closeBtn: { position: "absolute", top: 18, right: 18, padding: 8, zIndex: 10 },
  topSection: { alignItems: "center", gap: 10 },
  crownOrb: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "#111828",
    borderWidth: 1.5,
    borderColor: "#FFD70040",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: "OutfitBlack", fontSize: 28, color: "#FFF" },
  subtitle: { fontFamily: "OutfitSemiBold", fontSize: 14, color: Colors.light.muted },
  perksSection: { gap: 12 },
  perkRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  perkIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  perkText: { fontFamily: "OutfitSemiBold", fontSize: 14, color: "#E2E8F0", flex: 1, lineHeight: 20 },
  paywallBtn: {
    backgroundColor: "#FFD700",
    borderRadius: 16,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  disabledBtn: { opacity: 0.65 },
  paywallBtnText: { fontFamily: "OutfitBlack", fontSize: 15, color: "#060810" },
  planRow: { flexDirection: "row", gap: 10 },
  planBtn: {
    flex: 1,
    minHeight: 78,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1A2238",
    backgroundColor: "#080B14",
    justifyContent: "center",
    padding: 14,
    gap: 5,
  },
  featuredPlan: { borderColor: "#FFD70055" },
  disabledPlan: { opacity: 0.45 },
  planLabel: { fontFamily: "OutfitBold", fontSize: 12, color: Colors.light.muted, textTransform: "uppercase", letterSpacing: 1 },
  planPrice: { fontFamily: "OutfitBlack", fontSize: 18, color: Colors.light.text },
  restoreBtn: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  restoreText: { fontFamily: "OutfitBold", fontSize: 13, color: Colors.light.tint },
  legal: { fontFamily: "Outfit", fontSize: 11, color: "#475569", textAlign: "center", lineHeight: 16 },
  errorText: { fontFamily: "OutfitSemiBold", color: "#FF6A4D", fontSize: 12, textAlign: "center", lineHeight: 17 },
  successContainer: { alignItems: "center", paddingVertical: 30, gap: 16 },
  successOrb: { width: 88, height: 88, borderRadius: 44, backgroundColor: "#111828", borderWidth: 2, borderColor: "#FFD70050", alignItems: "center", justifyContent: "center" },
  successTitle: { fontFamily: "OutfitBlack", fontSize: 30, color: "#FFD700" },
  successSub: { fontFamily: "OutfitSemiBold", fontSize: 15, color: Colors.light.muted, textAlign: "center", lineHeight: 22 },
});
