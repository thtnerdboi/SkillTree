import React, { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDecay,
  cancelAnimation,
} from 'react-native-reanimated';

export interface PanZoomCanvasRef {
  centerOn: (x: number, y: number, screenWidth: number, screenHeight: number, animated?: boolean) => void;
}

interface Props {
  children: React.ReactNode;
  canvasWidth: number;
  canvasHeight: number;
}

export const PanZoomCanvas = forwardRef<PanZoomCanvasRef, Props>(
  ({ children, canvasWidth, canvasHeight }, ref) => {
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    useImperativeHandle(ref, () => ({
      centerOn: (x, y, screenWidth, screenHeight, animated = true) => {
        cancelAnimation(translateX);
        cancelAnimation(translateY);
        cancelAnimation(scale);

        const targetX = (screenWidth / 2) - x;
        const targetY = (screenHeight / 2) - y;

        if (animated) {
          translateX.value = withTiming(targetX, { duration: 650 });
          translateY.value = withTiming(targetY, { duration: 650 });
          scale.value = withTiming(1, { duration: 650 });
        } else {
          translateX.value = targetX;
          translateY.value = targetY;
          scale.value = 1;
        }

        savedTranslateX.value = targetX;
        savedTranslateY.value = targetY;
        savedScale.value = 1;
      }
    }));

    const pan = Gesture.Pan()
      .onStart(() => {
        cancelAnimation(translateX);
        cancelAnimation(translateY);
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      })
      .onUpdate((e) => {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      })
      .onEnd((e) => {
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
        const clampedScale = Math.max(0.3, Math.min(scale.value, 2.0));
        scale.value = withTiming(clampedScale, { duration: 250 });
        savedScale.value = clampedScale;
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
);

const styles = StyleSheet.create({
  canvas: {},
});