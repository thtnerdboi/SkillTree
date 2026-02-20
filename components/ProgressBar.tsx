import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

type ProgressBarProps = {
  progress: number;
  color: string;
  trackColor: string;
  height?: number;
};

export function ProgressBar({
  progress,
  color,
  trackColor,
  height = 10,
}: ProgressBarProps) {
  const animated = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animated, {
      toValue: progress,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [animated, progress]);

  return (
    <View style={[styles.track, { backgroundColor: trackColor, height }]}
      testID="progress-track"
    >
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: color,
            width: animated.interpolate({
              inputRange: [0, 100],
              outputRange: ["0%", "100%"],
            }),
            height,
          },
        ]}
        testID="progress-fill"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#21283B",
  },
  fill: {
    borderRadius: 999,
  },
});
