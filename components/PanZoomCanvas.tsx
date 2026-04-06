import React, { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDecay,
  cancelAnimation,
} from 'react-native-reanimated';

export interface PanZoomCanvasRef {
  centerOn: (x: number, y: number, animated?: boolean) => void;
  zoomBy: (delta: number, animated?: boolean) => void;
}

interface Props {
  children: React.ReactNode;
  canvasWidth: number;
  canvasHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  minScale?: number;
  maxScale?: number;
}

export const PanZoomCanvas = forwardRef<PanZoomCanvasRef, Props>(
  ({
    children,
    canvasWidth,
    canvasHeight,
    viewportWidth,
    viewportHeight,
  }, ref) => {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1); // Locked to 1
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    const getBounds = (nextScale: number) => {
      'worklet';
      const scaledWidth = canvasWidth * nextScale;
      const scaledHeight = canvasHeight * nextScale;
      const minX = Math.min(0, viewportWidth - scaledWidth);
      const maxX = scaledWidth <= viewportWidth ? (viewportWidth - scaledWidth) / 2 : 0;
      const minY = Math.min(0, viewportHeight - scaledHeight);
      const maxY = scaledHeight <= viewportHeight ? (viewportHeight - scaledHeight) / 2 : 0;
      return { minX, maxX, minY, maxY };
    };

    const isViewportReady = () => {
      'worklet';
      return viewportWidth > 0 && viewportHeight > 0;
    };

    const clampTranslate = (x: number, y: number, nextScale: number) => {
      'worklet';
      const bounds = getBounds(nextScale);
      return {
        x: clamp(x, bounds.minX, bounds.maxX),
        y: clamp(y, bounds.minY, bounds.maxY),
      };
    };

    const centerOnPoint = (x: number, y: number, animated: boolean) => {
      'worklet';
      const targetX = viewportWidth / 2 - x * scale.value;
      const targetY = viewportHeight / 2 - y * scale.value;
      const clamped = clampTranslate(targetX, targetY, scale.value);

      if (animated) {
        translateX.value = withTiming(clamped.x, {
          duration: 520,
          easing: Easing.out(Easing.cubic),
        });
        translateY.value = withTiming(clamped.y, {
          duration: 520,
          easing: Easing.out(Easing.cubic),
        });
      } else {
        translateX.value = clamped.x;
        translateY.value = clamped.y;
      }

      savedTranslateX.value = clamped.x;
      savedTranslateY.value = clamped.y;
    };

    useImperativeHandle(ref, () => ({
      centerOn: (x, y, animated = true) => {
        cancelAnimation(translateX);
        cancelAnimation(translateY);
        centerOnPoint(x, y, animated);
      },
      zoomBy: () => {
        // Feature disabled to maintain premium feel, keeping function signature to prevent index.tsx crashes
      },
    }));

    const pan = Gesture.Pan()
      .onStart(() => {
        if (!isViewportReady()) {
          return;
        }
        cancelAnimation(translateX);
        cancelAnimation(translateY);
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      })
      .onUpdate((e) => {
        // Lock X axis translation, only allow Y axis scrolling
        const nextX = savedTranslateX.value; 
        const nextY = savedTranslateY.value + e.translationY;
        
        const clamped = clampTranslate(nextX, nextY, scale.value);
        translateX.value = clamped.x;
        translateY.value = clamped.y;
      })
      .onEnd((e) => {
        const bounds = getBounds(scale.value);
        
        // Only decay the Y axis
        translateY.value = withDecay({
          velocity: e.velocityY,
          deceleration: 0.994,
          clamp: [bounds.minY, bounds.maxY],
          rubberBandEffect: false,
        });
      });

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { scale: scale.value },
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    }));

    return (
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.canvas, animatedStyle, { width: canvasWidth, height: canvasHeight }]}>
          {children}
        </Animated.View>
      </GestureDetector>
    );
  }
);

PanZoomCanvas.displayName = 'PanZoomCanvas';

const styles = StyleSheet.create({
  canvas: {},
});