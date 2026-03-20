import React from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDecay,
  cancelAnimation,
} from 'react-native-reanimated';

interface Props {
  children: React.ReactNode;
  canvasWidth: number;
  canvasHeight: number;
}

export function PanZoomCanvas({ children, canvasWidth, canvasHeight }: Props) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pan = Gesture.Pan()
    .onStart(() => {
      // 1. Cancel any leftover "gliding" from the last swipe
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      
      // 2. Save the exact current position of the map
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      // 3. Move relative to that starting position
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd((e) => {
      // 4. Glide to a stop (but don't save the values here anymore!)
      translateX.value = withDecay({ velocity: e.velocityX, deceleration: 0.998 });
      translateY.value = withDecay({ velocity: e.velocityY, deceleration: 0.998 });
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      cancelAnimation(scale);
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      // Prevent zooming too far in or out
      const clampedScale = Math.max(0.3, Math.min(scale.value, 2.0));
      scale.value = withTiming(clampedScale, { duration: 250 });
    });

  const composed = Gesture.Simultaneous(pan, pinch);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.canvas, animatedStyle, { width: canvasWidth, height: canvasHeight }]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  canvas: {},
});