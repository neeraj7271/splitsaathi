import React, { useEffect } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { BrandLogo } from "./BrandLogo";
import { ThemedText } from "./ThemedText";
import { gradients } from "../theme/colors";

type Props = {
  message?: string;
};

/**
 * In-app boot / loading state: Current Flow gradient + gently pulsing brand lockup.
 * Respects reduce-motion (static logo, no pulse).
 */
export function AnimatedBrandLoader({ message = "Loading your ledger" }: Props) {
  const pulse = useSharedValue(1);
  const split = useSharedValue(0);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) {
        pulse.value = 1;
        split.value = 0;
        return;
      }
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 700, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        false
      );
      split.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: 900, easing: Easing.in(Easing.cubic) })
        ),
        -1,
        false
      );
    });
    return () => {
      cancelled = true;
      cancelAnimation(pulse);
      cancelAnimation(split);
    };
  }, [pulse, split]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }]
  }));

  const tealGlow = useAnimatedStyle(() => ({
    opacity: 0.25 + split.value * 0.2,
    transform: [{ translateX: -8 * split.value }, { translateY: -6 * split.value }]
  }));

  const purpleGlow = useAnimatedStyle(() => ({
    opacity: 0.25 + (1 - split.value) * 0.2,
    transform: [{ translateX: 8 * split.value }, { translateY: 6 * split.value }]
  }));

  return (
    <LinearGradient
      colors={[gradients.current.start, gradients.current.end]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.root}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
    >
      <View style={styles.stage}>
        <Animated.View style={[styles.glow, styles.glowTeal, tealGlow]} />
        <Animated.View style={[styles.glow, styles.glowPurple, purpleGlow]} />
        <Animated.View style={logoStyle}>
          <BrandLogo variant="lockup" size={168} />
        </Animated.View>
      </View>
      <ThemedText variant="caption" style={styles.message}>
        {message}
      </ThemedText>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 24
  },
  stage: {
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center"
  },
  glow: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60
  },
  glowTeal: {
    backgroundColor: "#2EC4B6",
    left: 20,
    top: 30
  },
  glowPurple: {
    backgroundColor: "#9B6BFF",
    right: 20,
    bottom: 30
  },
  message: {
    color: "rgba(244,245,247,0.85)",
    textAlign: "center"
  }
});
