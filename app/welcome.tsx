import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Colors from "../constants/colors";

const WELCOME_KEY = "skilltree.welcomed";

type PercentPosition = `${number}%`;

type Branch = {
  left: PercentPosition;
  top: PercentPosition;
  width: number;
  rotate: `${number}deg`;
};

type TreeNode = {
  left: PercentPosition;
  top: PercentPosition;
  size: number;
  color: string;
};

const branches: Branch[] = [
  { left: "15%", top: "18%", width: 90, rotate: "24deg" },
  { left: "26%", top: "30%", width: 110, rotate: "-18deg" },
  { left: "52%", top: "22%", width: 130, rotate: "17deg" },
  { left: "40%", top: "44%", width: 145, rotate: "-26deg" },
  { left: "64%", top: "52%", width: 96, rotate: "25deg" },
];

const nodes: TreeNode[] = [
  { left: "16%", top: "17%", size: 16, color: Colors.light.tint },
  { left: "28%", top: "31%", size: 24, color: Colors.light.success },
  { left: "47%", top: "19%", size: 18, color: "#FFD166" },
  { left: "61%", top: "34%", size: 30, color: Colors.light.tint },
  { left: "39%", top: "49%", size: 20, color: Colors.light.success },
  { left: "69%", top: "56%", size: 18, color: "#FF8FA3" },
];

export default function WelcomeScreen() {
  const pulse = useRef(new Animated.Value(0)).current;
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    AsyncStorage.getItem(WELCOME_KEY)
      .then((welcomed) => {
        if (welcomed === "true") {
          router.replace("/(tabs)");
        }
      })
      .catch((error) => {
        console.warn("[welcome] Failed to read welcome state", error);
      });
  }, [pulse]);

  const nodeScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.18],
  });
  const nodeOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.62, 1],
  });
  const branchOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 0.46],
  });

  const beginJourney = async () => {
    setIsStarting(true);

    try {
      await AsyncStorage.setItem(WELCOME_KEY, "true");
      router.replace("/(tabs)");
    } catch (error) {
      console.warn("[welcome] Failed to save welcome state", error);
      setIsStarting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[Colors.light.background, Colors.light.surfaceDeep, "#11183A"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.treeLayer} pointerEvents="none">
        {branches.map((branch) => (
          <Animated.View
            key={`${branch.left}-${branch.top}`}
            style={[
              styles.branch,
              {
                left: branch.left,
                top: branch.top,
                width: branch.width,
                opacity: branchOpacity,
                transform: [{ rotate: branch.rotate }],
              },
            ]}
          />
        ))}
        {nodes.map((node) => (
          <Animated.View
            key={`${node.left}-${node.top}`}
            style={[
              styles.nodeGlow,
              {
                left: node.left,
                top: node.top,
                width: node.size * 2.7,
                height: node.size * 2.7,
                borderRadius: node.size * 1.35,
                opacity: nodeOpacity,
                transform: [{ scale: nodeScale }],
              },
            ]}
          >
            <View
              style={[
                styles.node,
                {
                  width: node.size,
                  height: node.size,
                  borderRadius: node.size / 2,
                  backgroundColor: node.color,
                },
              ]}
            />
          </Animated.View>
        ))}
      </View>

      <SafeAreaView style={styles.content}>
        <Text style={styles.logo}>● SKILLTREE / PLAYER ONE</Text>
        <View style={styles.hero}>
          <Text style={styles.heading}>REAL LIFE.{"\n"}GAME RULES.</Text>
          <Text style={styles.subtitle}>
            Pick your quests, move your pixel player, and unlock the next path.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={isStarting}
          onPress={beginJourney}
          style={({ pressed }) => [
            styles.button,
            (pressed || isStarting) && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>
            {isStarting ? "LOADING..." : "PRESS START"}
          </Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  treeLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  branch: {
    position: "absolute",
    height: 2,
    backgroundColor: Colors.light.tint,
    borderRadius: 2,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
  },
  nodeGlow: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(49, 92, 255, 0.16)",
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 18,
  },
  node: {
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.72)",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  logo: {
    color: Colors.light.tint,
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8,
  },
  hero: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 72,
  },
  heading: {
    color: Colors.light.text,
    fontFamily: "monospace",
    fontSize: 42,
    fontWeight: "900",
    lineHeight: 50,
    letterSpacing: -1,
    textAlign: "center",
  },
  subtitle: {
    color: Colors.light.muted,
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 27,
    marginTop: 18,
    textAlign: "center",
  },
  button: {
    alignItems: "center",
    backgroundColor: Colors.light.tint,
    borderRadius: 3,
    borderWidth: 3,
    borderColor: "#FFF3A3",
    justifyContent: "center",
    minHeight: 58,
    paddingHorizontal: 20,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
  },
  buttonPressed: {
    opacity: 0.72,
  },
  buttonText: {
    color: Colors.light.background,
    fontFamily: "monospace",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1.2,
    textAlign: "center",
  },
});


