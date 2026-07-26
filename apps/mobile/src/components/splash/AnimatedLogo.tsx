import React, { useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import type { SplashPalette } from "./tokens";
import { TEAL, PURPLE, splashSpacing, splashTimeline } from "./tokens";

const logoSource = require("../../../assets/brand/logo-mark.png");
const GLOW = 220;

type Props = {
  palette: SplashPalette;
  reduceMotion: boolean;
};

export function AnimatedLogo({ palette, reduceMotion }: Props) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.6);
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.9);
  const ringPulse = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      scale.value = 1;
      glowOpacity.value = 0.55;
      glowScale.value = 1;
      return;
    }

    opacity.value = withDelay(
      splashTimeline.logoStart,
      withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) })
    );
    scale.value = withDelay(
      splashTimeline.logoStart,
      withSpring(1, { damping: 13, stiffness: 150, mass: 0.85 })
    );

    glowOpacity.value = withDelay(splashTimeline.glowStart, withTiming(0.6, { duration: 500 }));
    glowScale.value = withDelay(splashTimeline.glowStart, withTiming(1, { duration: 500 }));
    glowOpacity.value = withDelay(
      splashTimeline.glowStart + 500,
      withRepeat(
        withSequence(
          withTiming(0.85, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.45, { duration: 1100, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );
    glowScale.value = withDelay(
      splashTimeline.glowStart + 500,
      withRepeat(
        withSequence(
          withTiming(1.1, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );
    ringPulse.value = withDelay(
      splashTimeline.glowStart,
      withRepeat(
        withSequence(
          withTiming(1.04, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );

    return () => {
      cancelAnimation(opacity);
      cancelAnimation(scale);
      cancelAnimation(glowOpacity);
      cancelAnimation(glowScale);
      cancelAnimation(ringPulse);
    };
  }, [glowOpacity, glowScale, opacity, reduceMotion, ringPulse, scale]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }]
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }]
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringPulse.value }],
    opacity: palette.mode === "dark" ? 0.9 : 0.55
  }));

  return (
    <View style={styles.stage} accessibilityRole="image" accessibilityLabel="SplitSaathi logo">
      <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none">
        <Svg width={GLOW} height={GLOW}>
          <Defs>
            <RadialGradient id="logoAura" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={TEAL} stopOpacity={palette.mode === "dark" ? 0.75 : 0.35} />
              <Stop offset="50%" stopColor={PURPLE} stopOpacity={palette.mode === "dark" ? 0.4 : 0.2} />
              <Stop offset="100%" stopColor={PURPLE} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill="url(#logoAura)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.rings, ringStyle]} pointerEvents="none">
        <View style={[styles.ringOuter, { borderColor: palette.orbitRing }]} />
        <View style={[styles.ringInner, { borderColor: palette.orbitRing }]} />
      </Animated.View>

      <Animated.View style={[styles.badge, palette.logoShadow, logoStyle]}>
        <Image source={logoSource} style={styles.mark} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center"
  },
  glow: {
    position: "absolute",
    width: GLOW,
    height: GLOW
  },
  rings: {
    position: "absolute",
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center"
  },
  ringOuter: {
    position: "absolute",
    width: 198,
    height: 198,
    borderRadius: 99,
    borderWidth: 1
  },
  ringInner: {
    position: "absolute",
    width: 168,
    height: 168,
    borderRadius: 84,
    borderWidth: 1
  },
  badge: {
    width: splashSpacing.logoSize,
    height: splashSpacing.logoSize,
    borderRadius: splashSpacing.logoSize / 2,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  mark: {
    width: "82%",
    height: "82%"
  }
});
