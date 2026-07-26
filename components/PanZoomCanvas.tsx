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
    minScale = 0.5,
    maxScale = 2.0,
  }, ref) => {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);
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

      zoomBy: (delta: number, animated = true) => {
        cancelAnimation(scale);
        cancelAnimation(translateX);
        cancelAnimation(translateY);

        const currentScale = scale.value;
        const newScale = Math.min(Math.max(currentScale + delta, minScale), maxScale);
        if (newScale === currentScale) return;

        // Keep the canvas-Y coordinate that's currently at the viewport centre stable.
        const canvasCenterY = (viewportHeight / 2 - translateY.value) / currentScale;
        let targetY = viewportHeight / 2 - canvasCenterY * newScale;

        // X: keep canvas horizontally centred at the new scale.
        let targetX = (viewportWidth - canvasWidth * newScale) / 2;

        // Clamp to valid bounds.
        const scaledWidth = canvasWidth * newScale;
        const scaledHeight = canvasHeight * newScale;
        const minXBound = Math.min(0, viewportWidth - scaledWidth);
        const maxXBound = scaledWidth <= viewportWidth ? (viewportWidth - scaledWidth) / 2 : 0;
        const minYBound = Math.min(0, viewportHeight - scaledHeight);
        const maxYBound = scaledHeight <= viewportHeight ? (viewportHeight - scaledHeight) / 2 : 0;

        targetX = Math.min(Math.max(targetX, minXBound), maxXBound);
        targetY = Math.min(Math.max(targetY, minYBound), maxYBound);

        const timingConfig = { duration: 280, easing: Easing.out(Easing.cubic) };

        if (animated) {
          scale.value = withTiming(newScale, timingConfig);
          translateX.value = withTiming(targetX, timingConfig);
          translateY.value = withTiming(targetY, timingConfig);
        } else {
          scale.value = newScale;
          translateX.value = targetX;
          translateY.value = targetY;
        }

        // Update saved values so the next pan gesture starts from the right position.
        savedTranslateX.value = targetX;
        savedTranslateY.value = targetY;
      },
    }));

    const pan = Gesture.Pan()
      .onStart(() => {
        if (!isViewportReady()) return;
        cancelAnimation(translateX);
        cancelAnimation(translateY);
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      })
      .onUpdate((e) => {
        const nextX = savedTranslateX.value + e.translationX;
        const nextY = savedTranslateY.value + e.translationY;
        const clamped = clampTranslate(nextX, nextY, scale.value);
        translateX.value = clamped.x;
        translateY.value = clamped.y;
      })
      .onEnd((e) => {
        const bounds = getBounds(scale.value);
        translateX.value = withDecay({
          velocity: e.velocityX,
          deceleration: 0.994,
          clamp: [bounds.minX, bounds.maxX],
          rubberBandEffect: false,
        });
        translateY.value = withDecay({
          velocity: e.velocityY,
          deceleration: 0.994,
          clamp: [bounds.minY, bounds.maxY],
          rubberBandEffect: false,
        });
      });

    // React Native's `scale` transform scales around the element's centre, but all
    // the pan/zoom math treats (0,0) as the scale origin (top-left). The compensation
    // terms below neutralise the centre-origin offset so both agree.
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { scale: scale.value },
        { translateX: translateX.value + (canvasWidth / 2) * (scale.value - 1) },
        { translateY: translateY.value + (canvasHeight / 2) * (scale.value - 1) },
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
