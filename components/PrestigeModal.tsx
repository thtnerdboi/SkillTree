import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Trophy } from "lucide-react-native";
import Colors from "@/constants/colors";
import { getPrestigeBonusLabel, getPrestigeRank } from "@/mocks/mvp-data";
import { useAppState } from "@/state/app-state";

export function PrestigeModal() {
  const { state, prestigeReady, prestigeRank, triggerPrestige, dismissPrestige } = useAppState();
  const nextRank = getPrestigeRank(state.prestigeCount + 1);
  const nextBonus = getPrestigeBonusLabel(state.prestigeCount + 1);

  return (
    <Modal visible={prestigeReady} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.orbWrap}>
            <View style={[styles.orb, { backgroundColor: `${nextRank.color}20`, borderColor: `${nextRank.color}60` }]}>
              <Trophy size={36} color={nextRank.color} strokeWidth={1.5} />
            </View>
          </View>
          <Text style={styles.super}>TREE COMPLETE</Text>
          <Text style={styles.title}>Prestige!</Text>
          <Text style={[styles.rankName, { color: nextRank.color }]}>{nextRank.name}</Text>
          <View style={[styles.bonusChip, { backgroundColor: `${nextRank.color}12`, borderColor: `${nextRank.color}35` }]}>
            <Text style={[styles.bonusChipText, { color: nextRank.color }]}>{nextBonus}</Text>
          </View>
          <Text style={styles.desc}>
            You cleared the full tree. Prestige resets challenges, keeps your rank identity, and permanently increases future XP gains.
          </Text>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: prestigeRank.color }]}
            onPress={triggerPrestige}
            testID="prestige-confirm"
          >
            <Text style={styles.btnText}>Begin New Journey</Text>
          </TouchableOpacity>
          <Pressable onPress={dismissPrestige} style={styles.dismiss}>
            <Text style={styles.dismissText}>Not yet</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center", padding: 24 },
  modal: { backgroundColor: "#0C1120", borderRadius: 30, padding: 32, alignItems: "center", gap: 14, borderWidth: 1, borderColor: "#1A2238", width: "100%" },
  orbWrap: { marginBottom: 4 },
  orb: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  super: { fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: Colors.light.muted, fontWeight: "700" },
  title: { fontSize: 42, fontWeight: "900", color: Colors.light.text },
  rankName: { fontSize: 22, fontWeight: "800", letterSpacing: 1 },
  bonusChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  bonusChipText: { fontSize: 12, fontWeight: "800" },
  desc: { fontSize: 14, lineHeight: 22, color: Colors.light.muted, textAlign: "center" },
  btn: { borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32, alignItems: "center", width: "100%", marginTop: 8 },
  btnText: { fontSize: 16, fontWeight: "800", color: "#060810" },
  dismiss: { paddingVertical: 8 },
  dismissText: { fontSize: 13, color: "#2A3560", fontWeight: "600" },
});