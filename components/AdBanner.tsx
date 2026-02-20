import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

type AdBannerProps = {
  style?: ViewStyle;
};

export function AdBanner({ style }: AdBannerProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>AD</Text>
      <Text style={styles.text}>Sponsored content will appear here</Text>
    </View>
  );
}

export function AdInterstitial() {
  return null;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0A0D18",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#1A2238",
    borderStyle: "dashed",
  },
  label: {
    fontSize: 9,
    fontWeight: "800",
    color: "#2A3560",
    letterSpacing: 1.5,
    borderWidth: 1,
    borderColor: "#2A3560",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  text: {
    fontSize: 11,
    color: "#2A3560",
    fontWeight: "500",
  },
});
