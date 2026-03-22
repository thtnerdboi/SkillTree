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
    maxScale = 2,
  }, ref) => {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);
    const savedScale = useSharedValue(1);

    const getScaleOffset = (nextScale: number) => {
      'worklet';
      return {
        x: (canvasWidth * (1 - nextScale)) / 2,
        y: (canvasHeight * (1 - nextScale)) / 2,
      };
    };

    const isViewportReady = () => {
      'worklet';
      return viewportWidth > 0 && viewportHeight > 0;
    };

    const getBounds = (nextScale: number) => {
      'worklet';
      if (!isViewportReady()) {
        return { minX: -Infinity, maxX: Infinity, minY: -Infinity, maxY: Infinity };
      }

      const scaledWidth = canvasWidth * nextScale;
      const scaledHeight = canvasHeight * nextScale;
      const scaleOffset = getScaleOffset(nextScale);

      const minX =
        scaledWidth <= viewportWidth
          ? (viewportWidth - scaledWidth) / 2 - scaleOffset.x
          : viewportWidth - scaledWidth - scaleOffset.x;
      const maxX =
        scaledWidth <= viewportWidth
          ? (viewportWidth - scaledWidth) / 2 - scaleOffset.x
          : -scaleOffset.x;
      const minY =
        scaledHeight <= viewportHeight
          ? (viewportHeight - scaledHeight) / 2 - scaleOffset.y
          : viewportHeight - scaledHeight - scaleOffset.y;
      const maxY =
        scaledHeight <= viewportHeight
          ? (viewportHeight - scaledHeight) / 2 - scaleOffset.y
          : -scaleOffset.y;
      return { minX, maxX, minY, maxY };
    };

    const clampTranslate = (x: number, y: number, nextScale: number) => {
      'worklet';
      if (!isViewportReady()) {
        return { x, y };
      }
      const bounds = getBounds(nextScale);
      return {
        x: clamp(x, bounds.minX, bounds.maxX),
        y: clamp(y, bounds.minY, bounds.maxY),
      };
    };

    const centerOnPoint = (x: number, y: number, animated: boolean) => {
      'worklet';
      if (!isViewportReady()) {
        return;
      }

      const scaleOffset = getScaleOffset(scale.value);
      const targetX = viewportWidth / 2 - x * scale.value - scaleOffset.x;
      const targetY = viewportHeight / 2 - y * scale.value - scaleOffset.y;
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
        if (viewportWidth <= 0 || viewportHeight <= 0) {
          return;
        }
        cancelAnimation(translateX);
        cancelAnimation(translateY);
        centerOnPoint(x, y, animated);
      },
      zoomBy: (delta, animated = true) => {
        if (viewportWidth <= 0 || viewportHeight <= 0) {
          return;
        }
        cancelAnimation(scale);
        cancelAnimation(translateX);
        cancelAnimation(translateY);

        const nextScale = clamp(scale.value + delta, minScale, maxScale);
        const centerX = viewportWidth / 2;
        const centerY = viewportHeight / 2;
        const prevOffset = getScaleOffset(scale.value);
        const nextOffset = getScaleOffset(nextScale);
        const factor = nextScale / scale.value;
        const targetX = centerX - factor * (centerX - translateX.value - prevOffset.x) - nextOffset.x;
        const targetY = centerY - factor * (centerY - translateY.value - prevOffset.y) - nextOffset.y;
        const clamped = clampTranslate(targetX, targetY, nextScale);

        if (animated) {
          scale.value = withTiming(nextScale, { duration: 220, easing: Easing.out(Easing.cubic) });
          translateX.value = withTiming(clamped.x, { duration: 220, easing: Easing.out(Easing.cubic) });
          translateY.value = withTiming(clamped.y, { duration: 220, easing: Easing.out(Easing.cubic) });
        } else {
          scale.value = nextScale;
          translateX.value = clamped.x;
          translateY.value = clamped.y;
        }

        savedScale.value = nextScale;
        savedTranslateX.value = clamped.x;
        savedTranslateY.value = clamped.y;
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
        if (!isViewportReady()) {
          return;
        }
        const nextX = savedTranslateX.value + e.translationX;
        const nextY = savedTranslateY.value + e.translationY;
        const clamped = clampTranslate(nextX, nextY, scale.value);
        translateX.value = clamped.x;
        translateY.value = clamped.y;
      })
      .onEnd((e) => {
        if (!isViewportReady()) {
          return;
        }
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

    const pinch = Gesture.Pinch()
      .onStart((e) => {
        if (!isViewportReady()) {
          return;
        }
        cancelAnimation(scale);
        cancelAnimation(translateX);
        cancelAnimation(translateY);
        savedScale.value = scale.value;
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      })
      .onUpdate((e) => {
        if (!isViewportReady()) {
          return;
        }
        const nextScale = clamp(savedScale.value * e.scale, minScale, maxScale);
        const ratio = nextScale / savedScale.value;
        const prevOffset = getScaleOffset(savedScale.value);
        const nextOffset = getScaleOffset(nextScale);
        const nextX = e.focalX - ratio * (e.focalX - savedTranslateX.value - prevOffset.x) - nextOffset.x;
        const nextY = e.focalY - ratio * (e.focalY - savedTranslateY.value - prevOffset.y) - nextOffset.y;
        const clamped = clampTranslate(nextX, nextY, nextScale);

        scale.value = nextScale;
        translateX.value = clamped.x;
        translateY.value = clamped.y;
      })
      .onEnd(() => {
        if (!isViewportReady()) {
          return;
        }
        savedScale.value = scale.value;
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      });

    const gesture = Gesture.Simultaneous(pan, pinch);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { scale: scale.value },
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    }));

    return (
      <GestureDetector gesture={gesture}>
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
