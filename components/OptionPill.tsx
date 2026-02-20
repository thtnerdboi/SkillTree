import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import Colors from "../constants/colors";

type OptionPillProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
};

export function OptionPill({ label, selected, onPress, testID }: OptionPillProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        selected ? styles.pillSelected : null,
        pressed ? styles.pillPressed : null,
      ]}
      testID={testID}
    >
      <Text style={[styles.label, selected ? styles.labelSelected : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#0E1120",
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  pillSelected: {
    backgroundColor: "#0F1B2D",
    borderColor: Colors.light.tint,
  },
  pillPressed: {
    opacity: 0.85,
  },
  label: {
    color: Colors.light.text,
    fontWeight: "600",
    fontSize: 13,
  },
  labelSelected: {
    color: Colors.light.tint,
  },
});
