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

// How many px the user can overscroll past the canvas edge on each axis.
const EDGE_PADDING = 80;

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
    const scale     = useSharedValue(1);
    const savedX    = useSharedValue(0);
    const savedY    = useSharedValue(0);

    // Bounds for translateX / translateY given a scale value.
    // Our effective transform is:  screen_pos = canvas_pos * scale + translate
    // (the animatedStyle compensation below makes this exact).
    const getBounds = (s: number) => {
      'worklet';
      const sw = canvasWidth  * s;
      const sh = canvasHeight * s;

      // Horizontal: keep canvas covering the viewport with EDGE_PADDING leeway.
      const minX = sw <= viewportWidth
        ? (viewportWidth - sw) / 2          // canvas narrower: centre it
        : viewportWidth - sw - EDGE_PADDING; // allow scroll to right edge + pad
      const maxX = sw <= viewportWidth
        ? (viewportWidth - sw) / 2
        : EDGE_PADDING;                      // allow scroll to left edge + pad

      // Vertical: same logic.
      const minY = sh <= viewportHeight
        ? (viewportHeight - sh) / 2
        : viewportHeight - sh - EDGE_PADDING;
      const maxY = sh <= viewportHeight
        ? (viewportHeight - sh) / 2
        : EDGE_PADDING;

      return { minX, maxX, minY, maxY };
    };

    const clampTo = (v: number, lo: number, hi: number) => {
      'worklet';
      return Math.max(lo, Math.min(hi, v));
    };

    // ── Imperative handle (called from JS thread → dispatch to UI thread) ──
    useImperativeHandle(ref, () => ({

      centerOn: (x: number, y: number, animated = true) => {
        runOnUI(() => {
          'worklet';
          cancelAnimation(translateX);
          cancelAnimation(translateY);

          const s  = scale.value;
          const tx = viewportWidth  / 2 - x * s;
          const ty = viewportHeight / 2 - y * s;
          const b  = getBounds(s);
          const cx = clampTo(tx, b.minX, b.maxX);
          const cy = clampTo(ty, b.minY, b.maxY);

          if (animated) {
            const cfg = { duration: 520, easing: Easing.out(Easing.cubic) };
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

          const s        = scale.value;
          const newScale = Math.min(Math.max(s + delta, minScale), maxScale);
          if (newScale === s) return;

          // Keep the canvas-Y coord currently at viewport centre stable.
          const anchorY  = (viewportHeight / 2 - translateY.value) / s;
          let   ty       = viewportHeight / 2 - anchorY * newScale;
          // Keep canvas horizontally centred.
          let   tx       = (viewportWidth - canvasWidth * newScale) / 2;

          const b = getBounds(newScale);
          tx = clampTo(tx, b.minX, b.maxX);
          ty = clampTo(ty, b.minY, b.maxY);

          if (animated) {
            const cfg = { duration: 280, easing: Easing.out(Easing.cubic) };
            scale.value      = withTiming(newScale, cfg);
            translateX.value = withTiming(tx, cfg);
            translateY.value = withTiming(ty, cfg);
          } else {
            scale.value      = newScale;
            translateX.value = tx;
            translateY.value = ty;
          }
          savedX.value = tx;
          savedY.value = ty;
        })();
      },
    }));

    // ── Pan gesture (runs as worklet on UI thread via Reanimated) ──
    const pan = Gesture.Pan()
      .onStart(() => {
        cancelAnimation(translateX);
        cancelAnimation(translateY);
        savedX.value = translateX.value;
        savedY.value = translateY.value;
      })
      .onUpdate((e) => {
        const b  = getBounds(scale.value);
        translateX.value = clampTo(savedX.value + e.translationX, b.minX, b.maxX);
        translateY.value = clampTo(savedY.value + e.translationY, b.minY, b.maxY);
      })
      .onEnd((e) => {
        const b = getBounds(scale.value);
        translateX.value = withDecay({
          velocity: e.velocityX,
          deceleration: 0.994,
          clamp: [b.minX, b.maxX],
          rubberBandEffect: false,
        });
        translateY.value = withDecay({
          velocity: e.velocityY,
          deceleration: 0.994,
          clamp: [b.minY, b.maxY],
          rubberBandEffect: false,
        });
      });

    // React Native scales around the element's centre, but our math treats (0,0)
    // as the scale origin. The extra translate terms compensate so that
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
          style={[
            styles.canvas,
            animatedStyle,
            { width: canvasWidth, height: canvasHeight },
          ]}
        >
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
