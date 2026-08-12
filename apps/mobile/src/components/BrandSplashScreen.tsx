import React, { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme";
import { AnimatedGradient } from "./splash/AnimatedGradient";
import { AnimatedLogo } from "./splash/AnimatedLogo";
import { BottomWave } from "./splash/BottomWave";
import { FloatingIcons } from "./splash/FloatingIcons";
import { useSplashGlowAnchor, useSplashLayout } from "./splash/layout";
import { LoadingDots } from "./splash/LoadingDots";
import {
  PURPLE,
  SPLASH_TAGLINE,
  TEAL,
  splashDarkPalette,
  splashLightPalette,
  splashSpacing,
  splashTimeline
} from "./splash/tokens";

type Props = {
  onFinished?: () => void;
  statusMessage?: string;
};

/**
 * One splash layout (light-mode design) for both themes — only palette colors change.
 */
export function BrandSplashScreen({ onFinished, statusMessage }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(false);

  const palette = useMemo(
    () => (theme.mode === "light" ? splashLightPalette : splashDarkPalette),
    [theme.mode]
  );
  const layout = useSplashLayout();
  const glowAnchor = useSplashGlowAnchor(layout, insets);

  const nameOpacity = useSharedValue(0);
  const nameY = useSharedValue(10);
  const tagOpacity = useSharedValue(0);
  const tagY = useSharedValue(8);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!cancelled) {
          setReduceMotion(reduced);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      nameOpacity.value = 1;
      nameY.value = 0;
      tagOpacity.value = 1;
      tagY.value = 0;
      onFinished?.();
      return;
    }

    nameOpacity.value = withDelay(
      splashTimeline.nameStart,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) })
    );
    nameY.value = withDelay(
      splashTimeline.nameStart,
      withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) })
    );
    tagOpacity.value = withDelay(
      splashTimeline.taglineStart,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) })
    );
    tagY.value = withDelay(
      splashTimeline.taglineStart,
      withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) })
    );

    return () => {
      cancelAnimation(nameOpacity);
      cancelAnimation(nameY);
      cancelAnimation(tagOpacity);
      cancelAnimation(tagY);
    };
  }, [nameOpacity, nameY, onFinished, reduceMotion, tagOpacity, tagY]);

  const nameStyle = useAnimatedStyle(() => ({
    opacity: nameOpacity.value,
    transform: [{ translateY: nameY.value }]
  }));
  const tagStyle = useAnimatedStyle(() => ({
    opacity: tagOpacity.value,
    transform: [{ translateY: tagY.value }]
  }));

  return (
    <View style={[styles.root, { backgroundColor: palette.gradient[0] }]} accessibilityLabel="SplitSaathi">
      <AnimatedGradient palette={palette} reduceMotion={reduceMotion} glowAnchor={glowAnchor} />

      <View
        style={[
          styles.center,
          {
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: Math.max(insets.bottom, 12) + 110
          }
        ]}
      >
        <View
          style={[
            styles.hero,
            {
              width: layout.heroSize,
              height: layout.heroSize,
              marginBottom: splashSpacing.logoToTitle
            }
          ]}
        >
          <View style={styles.heroLayer}>
            <FloatingIcons palette={palette} reduceMotion={reduceMotion} orbitRadius={layout.orbitRadius} />
            <View style={styles.logoAnchor}>
              <AnimatedLogo
                palette={palette}
                reduceMotion={reduceMotion}
                logoSize={layout.logoSize}
                stageSize={layout.stageSize}
              />
            </View>
          </View>
        </View>

        <Animated.View style={[styles.nameBlock, nameStyle]}>
          <View style={styles.nameRow}>
            <Animated.Text style={styles.nameSplit}>Split</Animated.Text>
            <Animated.Text style={styles.nameSaathi}>Saathi</Animated.Text>
          </View>
          <View style={[styles.dividerTrack, { backgroundColor: palette.dividerTrack }]}>
            <LinearGradient
              colors={[TEAL, PURPLE]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.dividerFill}
            />
          </View>
        </Animated.View>

        <Animated.Text style={[styles.tagline, { color: palette.textSecondary }, tagStyle]}>
          {SPLASH_TAGLINE}
        </Animated.Text>

        <View style={styles.dotsWrap}>
          <LoadingDots palette={palette} reduceMotion={reduceMotion} activeIndex={1} />
        </View>

        {statusMessage ? (
          <Animated.Text style={[styles.statusMessageText, { color: palette.textSecondary }, tagStyle]}>
            {statusMessage}
          </Animated.Text>
        ) : null}
      </View>

      <BottomWave palette={palette} reduceMotion={reduceMotion} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden"
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    zIndex: 2
  },
  hero: {
    alignSelf: "center"
  },
  heroLayer: {
    ...StyleSheet.absoluteFillObject
  },
  logoAnchor: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center"
  },
  nameBlock: {
    alignItems: "center",
    gap: 10
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "baseline"
  },
  nameSplit: {
    fontFamily: "Inter_700Bold",
    fontSize: 34,
    letterSpacing: 0.3,
    color: TEAL
  },
  nameSaathi: {
    fontFamily: "Inter_700Bold",
    fontSize: 34,
    letterSpacing: 0.3,
    color: PURPLE
  },
  dividerTrack: {
    width: 72,
    height: 2,
    borderRadius: 2,
    overflow: "hidden"
  },
  dividerFill: {
    width: "100%",
    height: "100%"
  },
  tagline: {
    marginTop: splashSpacing.titleToTagline,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 260
  },
  dotsWrap: {
    marginTop: splashSpacing.taglineToDots
  },
  statusMessageText: {
    marginTop: 12,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    letterSpacing: 0.2,
    textAlign: "center",
    opacity: 0.85
  }
});

export default BrandSplashScreen;
