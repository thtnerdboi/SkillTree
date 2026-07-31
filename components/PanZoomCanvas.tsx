import React, { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnUI,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDecay,
  withSpring,
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
  snapYPositions?: number[];
}

export const PanZoomCanvas = forwardRef<PanZoomCanvasRef, Props>(
  ({
    children,
    canvasWidth,
    canvasHeight,
    viewportWidth,
    viewportHeight,
    minScale = 0.6,
    maxScale = 1.6,
    snapYPositions,
  }, ref) => {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale      = useSharedValue(1);
    const savedX     = useSharedValue(0);
    const savedY     = useSharedValue(0);

    // Effective transform: screen_pos = canvas_pos * scale + translate
    // (animatedStyle compensation makes this exact despite RN scaling around centre)
    const getBounds = (s: number) => {
      'worklet';
      const sw = canvasWidth  * s;
      const sh = canvasHeight * s;
      const minX = sw <= viewportWidth  ? (viewportWidth  - sw) / 2 : viewportWidth  - sw;
      const maxX = sw <= viewportWidth  ? (viewportWidth  - sw) / 2 : 0;
      const minY = sh <= viewportHeight ? (viewportHeight - sh) / 2 : viewportHeight - sh;
      const maxY = sh <= viewportHeight ? (viewportHeight - sh) / 2 : 0;
      return { minX, maxX, minY, maxY };
    };

    useImperativeHandle(ref, () => ({
      centerOn: (x: number, y: number, animated = true) => {
        runOnUI(() => {
          'worklet';
          cancelAnimation(translateX);
          cancelAnimation(translateY);
          const s  = scale.value;
          const b  = getBounds(s);
          const cx = Math.max(b.minX, Math.min(b.maxX, viewportWidth  / 2 - x * s));
          const cy = Math.max(b.minY, Math.min(b.maxY, viewportHeight / 2 - y * s));
          if (animated) {
            const cfg = { duration: 480, easing: Easing.out(Easing.cubic) };
            translateX.value = withTiming(cx, cfg);
            translateY.value = withTiming(cy, cfg);
          } else {
            translateX.value = cx;
            translateY.value = cy;
          }
          savedX.value = cx;
          savedY.value = cy;
        })();
      },

      zoomBy: (delta: number, animated = true) => {
        runOnUI(() => {
          'worklet';
          cancelAnimation(scale);
          cancelAnimation(translateX);
          cancelAnimation(translateY);
          const s  = scale.value;
          const ns = Math.min(Math.max(s + delta, minScale), maxScale);
          if (ns === s) return;
          // Keep canvas point at viewport centre stable on both axes
          const anchorX = (viewportWidth  / 2 - translateX.value) / s;
          const anchorY = (viewportHeight / 2 - translateY.value) / s;
          const b  = getBounds(ns);
          const tx = Math.max(b.minX, Math.min(b.maxX, viewportWidth  / 2 - anchorX * ns));
          const ty = Math.max(b.minY, Math.min(b.maxY, viewportHeight / 2 - anchorY * ns));
          if (animated) {
            const cfg = { duration: 260, easing: Easing.out(Easing.quad) };
            scale.value      = withTiming(ns, cfg);
            translateX.value = withTiming(tx, cfg);
            translateY.value = withTiming(ty, cfg);
          } else {
            scale.value      = ns;
            translateX.value = tx;
            translateY.value = ty;
          }
          savedX.value = tx;
          savedY.value = ty;
        })();
      },
    }));

    const pan = Gesture.Pan()
      .onStart(() => {
        cancelAnimation(translateX);
        cancelAnimation(translateY);
        savedX.value = translateX.value;
        savedY.value = translateY.value;
      })
      .onUpdate((e) => {
        const b = getBounds(scale.value);
        translateX.value = Math.max(b.minX, Math.min(b.maxX, savedX.value + e.translationX));
        translateY.value = Math.max(b.minY, Math.min(b.maxY, savedY.value + e.translationY));
      })
      .onEnd((e) => {
        const s = scale.value;
        const b = getBounds(s);

        if (snapYPositions && snapYPositions.length > 0) {
          // Estimate natural deceleration landing point
          const totalDrift  = e.velocityY / (60 * (1 - 0.994));
          const estimatedTy = translateY.value + totalDrift;
          const estimatedCY = (viewportHeight / 2 - estimatedTy) / s;

          let nearestY = snapYPositions[0];
          let minDist  = Math.abs(snapYPositions[0] - estimatedCY);
          for (let i = 1; i < snapYPositions.length; i++) {
            const d = Math.abs(snapYPositions[i] - estimatedCY);
            if (d < minDist) { minDist = d; nearestY = snapYPositions[i]; }
          }

          const targetTy = Math.max(b.minY, Math.min(b.maxY,
            viewportHeight / 2 - nearestY * s
          ));
          translateY.value = withSpring(targetTy, {
            damping: 38, stiffness: 240, mass: 1, overshootClamping: false,
          });
        } else {
          translateY.value = withDecay({
            velocity: e.velocityY, deceleration: 0.994, clamp: [b.minY, b.maxY],
          });
        }

        translateX.value = withDecay({
          velocity: e.velocityX, deceleration: 0.994, clamp: [b.minX, b.maxX],
        });
      });

    // React Native scales around element centre; these terms compensate so
    // screen_x = canvas_x * scale + translateX  (and same for Y).
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { scale: scale.value },
        { translateX: translateX.value + (canvasWidth  / 2) * (scale.value - 1) },
        { translateY: translateY.value + (canvasHeight / 2) * (scale.value - 1) },
      ],
    }));

    return (
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[styles.canvas, animatedStyle,
            { width: canvasWidth, height: canvasHeight }]}
        >
          {children}
        </Animated.View>
      </GestureDetector>
    );
  }
);

PanZoomCanvas.displayName = 'PanZoomCanvas';
const styles = StyleSheet.create({ canvas: {} });
