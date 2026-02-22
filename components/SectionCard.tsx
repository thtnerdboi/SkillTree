import React from "react";
import { StyleSheet, Text, View } from "react-native";

import Colors from "../constants/colors";

type SectionCardProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
};

export function SectionCard({ title, subtitle, right, children }: SectionCardProps) {
  return (
    <View style={styles.card} testID={`section-${title}`}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: "#02030A",
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.light.muted,
    marginTop: 4,
  },
});
