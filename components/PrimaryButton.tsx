import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import Colors from "../constants/colors";

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  testID?: string;
};

export function PrimaryButton({ label, onPress, testID }: PrimaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed ? styles.buttonPressed : null,
      ]}
      testID={testID}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  label: {
    color: "#05060C",
    fontWeight: "700",
  },
});
