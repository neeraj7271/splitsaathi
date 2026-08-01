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
import { PURPLE, splashLayoutDefaults, splashSpacing, splashTimeline, TEAL } from "./tokens";

const logoSource = require("../../../assets/brand/logo-mark.png");
const GLOW = splashLayoutDefaults.glowSize;

type Props = {
  palette: SplashPalette;
  reduceMotion: boolean;
  logoSize?: number;
  stageSize?: number;
};

export function AnimatedLogo({
  palette,
  reduceMotion,
  logoSize = splashSpacing.logoSize,
  stageSize = GLOW
}: Props) {
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

  const glowSize = stageSize;
  const ringSize = Math.round(stageSize * 0.91);
  const ringInnerSize = Math.round(stageSize * 0.764);
  const logoNudgeY = Math.round(logoSize * 0.03);

  const centerLayer = (size: number, offsetY = 0) => ({
    position: "absolute" as const,
    top: "50%" as const,
    left: "50%" as const,
    width: size,
    height: size,
    marginTop: -size / 2 + offsetY,
    marginLeft: -size / 2
  });

  return (
    <View style={[styles.stage, { width: stageSize, height: stageSize }]} accessibilityRole="image" accessibilityLabel="SplitSaathi logo">
      <Animated.View style={[glowStyle, centerLayer(glowSize)]} pointerEvents="none">
        <Svg width={glowSize} height={glowSize}>
          <Defs>
            <RadialGradient id="logoAura" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={TEAL} stopOpacity={palette.mode === "dark" ? 0.75 : 0.35} />
              <Stop offset="50%" stopColor={PURPLE} stopOpacity={palette.mode === "dark" ? 0.4 : 0.2} />
              <Stop offset="100%" stopColor={PURPLE} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={glowSize / 2} cy={glowSize / 2} r={glowSize / 2} fill="url(#logoAura)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[ringStyle, centerLayer(ringSize), styles.rings]} pointerEvents="none">
        <View
          style={[
            styles.ringOuter,
            {
              width: ringSize - 2,
              height: ringSize - 2,
              borderRadius: (ringSize - 2) / 2,
              borderColor: palette.orbitRing,
              top: 1,
              left: 1
            }
          ]}
        />
        <View
          style={[
            styles.ringInner,
            {
              width: ringInnerSize,
              height: ringInnerSize,
              borderRadius: ringInnerSize / 2,
              borderColor: palette.orbitRing,
              top: (ringSize - ringInnerSize) / 2,
              left: (ringSize - ringInnerSize) / 2
            }
          ]}
        />
      </Animated.View>

      <Animated.View
        style={[
          logoStyle,
          centerLayer(logoSize, logoNudgeY),
          palette.logoShadow,
          styles.badge,
          {
            width: logoSize,
            height: logoSize,
            borderRadius: logoSize / 2
          }
        ]}
      >
        <Image source={logoSource} style={styles.mark} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: "center",
    justifyContent: "center"
  },
  rings: {
    alignItems: "center",
    justifyContent: "center"
  },
  ringOuter: {
    position: "absolute",
    borderWidth: 1
  },
  ringInner: {
    position: "absolute",
    borderWidth: 1
  },
  badge: {
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
