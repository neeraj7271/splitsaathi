import React, { useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";

import type { SplashPalette } from "./tokens";
import type { SplashGlowAnchor } from "./layout";

const { width: W, height: H } = Dimensions.get("window");

type Props = {
  palette: SplashPalette;
  reduceMotion: boolean;
  glowAnchor: SplashGlowAnchor;
};

export function AnimatedGradient({ palette, reduceMotion, glowAnchor }: Props) {
  const shift = useSharedValue(0);
  const pulse = useSharedValue(0.85);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    shift.value = withRepeat(
      withTiming(1, { duration: 16000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.75, { duration: 2800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    return () => {
      cancelAnimation(shift);
      cancelAnimation(pulse);
    };
  }, [pulse, reduceMotion, shift]);

  const driftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(shift.value, [0, 1], [0, -24]) }]
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: pulse.value
  }));

  return (
    <View style={styles.fill} pointerEvents="none">
      <Animated.View style={[styles.fill, driftStyle]}>
        <LinearGradient
          colors={[...palette.gradient]}
          locations={[...palette.gradientLocations]}
          start={{ x: 0.05, y: 0 }}
          end={{ x: 0.95, y: 1 }}
          style={[styles.fill, { height: H + 48 }]}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.centerGlow,
          glowStyle,
          {
            top: glowAnchor.top,
            left: glowAnchor.left,
            width: glowAnchor.size,
            height: glowAnchor.size,
            borderRadius: glowAnchor.size / 2
          }
        ]}
      >
        <LinearGradient
          colors={[palette.centerGlow, "transparent"]}
          style={styles.centerGlowInner}
        />
      </Animated.View>

      {STAR_LAYOUT.map((star, index) => (
        <View
          key={star.id}
          style={[
            styles.star,
            {
              top: star.top * H,
              left: star.left * W,
              width: star.size,
              height: star.size,
              borderRadius: star.size,
              backgroundColor: palette.starColors[index % palette.starColors.length],
              opacity: palette.mode === "dark" ? star.opacity : star.opacity * 0.45
            }
          ]}
        />
      ))}
    </View>
  );
}

const STAR_LAYOUT = [
  { id: "a", top: 0.08, left: 0.12, size: 3, opacity: 0.7 },
  { id: "b", top: 0.14, left: 0.78, size: 2, opacity: 0.55 },
  { id: "c", top: 0.2, left: 0.88, size: 3, opacity: 0.5 },
  { id: "d", top: 0.1, left: 0.48, size: 2, opacity: 0.4 },
  { id: "e", top: 0.28, left: 0.08, size: 2, opacity: 0.45 },
  { id: "f", top: 0.34, left: 0.72, size: 3, opacity: 0.35 },
  { id: "g", top: 0.22, left: 0.36, size: 2, opacity: 0.5 },
  { id: "h", top: 0.4, left: 0.9, size: 2, opacity: 0.4 },
  { id: "i", top: 0.16, left: 0.22, size: 2, opacity: 0.35 }
];

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject
  },
  centerGlow: {
    position: "absolute",
    overflow: "hidden"
  },
  centerGlowInner: {
    width: "100%",
    height: "100%"
  },
  star: {
    position: "absolute"
  }
});
