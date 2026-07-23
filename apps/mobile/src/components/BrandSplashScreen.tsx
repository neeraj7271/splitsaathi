/**
 * SplitSaathi animated splash / first-load screen.
 * Uses brand icon + transparent wordmark with light/dark adaptation.
 */
import React, { useEffect } from "react";
import { AccessibilityInfo, Dimensions, Image, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import { useTheme } from "../theme";
import { ThemedText } from "./ThemedText";

const { width: windowWidth } = Dimensions.get("window");
const ICON_SIZE = 190;
const GLOW_SIZE = 260;
const TEAL = "#1AA88A";
const PURPLE = "#5B4FCF";

const iconSource = require("../../assets/brand/logo-mark.png");
const wordmarkSource = require("../../assets/brand/logo-wordmark.png");

type Props = {
  message?: string;
  /** Called once the entrance animation settles */
  onFinished?: () => void;
  backgroundColor?: string;
};

export function BrandSplashScreen({ message = "Loading your ledger", onFinished, backgroundColor }: Props) {
  const theme = useTheme();
  const isDark = theme.mode === "dark";

  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.6);
  const iconClip = useSharedValue(0);
  const iconOpacity = useSharedValue(0);
  const iconScale = useSharedValue(0.72);
  const iconRotate = useSharedValue(-14);
  const wordOpacity = useSharedValue(0);
  const wordTranslateY = useSharedValue(16);
  const dotsOpacity = useSharedValue(0);

  useEffect(() => {
    let cancelled = false;
    let reduceMotion = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (cancelled) {
          return;
        }
        reduceMotion = reduced;
        if (reduced) {
          glowOpacity.value = isDark ? 0.45 : 0.28;
          glowScale.value = 1;
          iconClip.value = 1;
          iconOpacity.value = 1;
          iconScale.value = 1;
          iconRotate.value = 0;
          wordOpacity.value = 1;
          wordTranslateY.value = 0;
          dotsOpacity.value = 1;
          onFinished?.();
          return;
        }

        glowOpacity.value = withDelay(200, withTiming(isDark ? 0.55 : 0.32, { duration: 1000, easing: Easing.out(Easing.cubic) }));
        glowScale.value = withDelay(200, withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) }));

        iconClip.value = withDelay(180, withTiming(1, { duration: 850, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
        iconOpacity.value = withDelay(260, withTiming(1, { duration: 900, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
        iconScale.value = withDelay(260, withTiming(1, { duration: 900, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
        iconRotate.value = withDelay(260, withTiming(0, { duration: 900, easing: Easing.bezier(0.16, 1, 0.3, 1) }));

        wordOpacity.value = withDelay(820, withTiming(1, { duration: 750, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
        wordTranslateY.value = withDelay(820, withTiming(0, { duration: 750, easing: Easing.bezier(0.16, 1, 0.3, 1) }));

        dotsOpacity.value = withDelay(
          1400,
          withTiming(1, { duration: 450 }, (finished) => {
            if (finished && onFinished) {
              runOnJS(onFinished)();
            }
          })
        );

        iconScale.value = withDelay(
          1600,
          withRepeat(
            withSequence(
              withTiming(1.045, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
              withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
          )
        );
        glowScale.value = withDelay(
          1500,
          withRepeat(
            withSequence(
              withTiming(1.12, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
              withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
          )
        );
        glowOpacity.value = withDelay(
          1500,
          withRepeat(
            withSequence(
              withTiming(isDark ? 0.7 : 0.4, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
              withTiming(isDark ? 0.45 : 0.24, { duration: 1400, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
          )
        );
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      if (!reduceMotion) {
        cancelAnimation(glowOpacity);
        cancelAnimation(glowScale);
        cancelAnimation(iconClip);
        cancelAnimation(iconOpacity);
        cancelAnimation(iconScale);
        cancelAnimation(iconRotate);
        cancelAnimation(wordOpacity);
        cancelAnimation(wordTranslateY);
        cancelAnimation(dotsOpacity);
      }
    };
  }, [
    dotsOpacity,
    glowOpacity,
    glowScale,
    iconClip,
    iconOpacity,
    iconRotate,
    iconScale,
    isDark,
    onFinished,
    wordOpacity,
    wordTranslateY
  ]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }]
  }));

  const iconMaskStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconClip.value }]
  }));

  const iconImgStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ scale: iconScale.value }, { rotate: `${iconRotate.value}deg` }]
  }));

  const wordStyle = useAnimatedStyle(() => ({
    opacity: wordOpacity.value,
    transform: [{ translateY: wordTranslateY.value }]
  }));

  const dotsStyle = useAnimatedStyle(() => ({
    opacity: dotsOpacity.value
  }));

  const stageBg = backgroundColor ?? (isDark ? "#0A0A0D" : theme.colors.canvas);
  const badgeBg = isDark ? "#FFFFFF" : "#FFFFFF";
  const badgeBorder = isDark ? "transparent" : theme.colors.hairline;
  const dotColor = isDark ? PURPLE : theme.colors.confirmed;

  return (
    <View
      style={[styles.stage, { backgroundColor: stageBg }]}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
    >
      <View style={styles.wrap}>
        <Animated.View style={[styles.glowWrap, glowStyle]} pointerEvents="none">
          <Svg width={GLOW_SIZE} height={GLOW_SIZE}>
            <Defs>
              <RadialGradient id="splashGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={TEAL} stopOpacity={isDark ? 0.9 : 0.75} />
                <Stop offset="55%" stopColor={PURPLE} stopOpacity={isDark ? 0.6 : 0.45} />
                <Stop offset="100%" stopColor={PURPLE} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={GLOW_SIZE / 2} cy={GLOW_SIZE / 2} r={GLOW_SIZE / 2} fill="url(#splashGlow)" />
          </Svg>
        </Animated.View>

        <Animated.View
          style={[
            styles.iconMask,
            iconMaskStyle,
            {
              backgroundColor: badgeBg,
              borderColor: badgeBorder,
              borderWidth: isDark ? 0 : 1,
              shadowOpacity: isDark ? 0.35 : 0.12
            }
          ]}
        >
          <Animated.View style={[styles.iconInner, iconImgStyle]}>
            <Image source={iconSource} style={styles.iconImage} resizeMode="contain" />
          </Animated.View>
        </Animated.View>

        <Animated.View style={[styles.wordmarkWrap, wordStyle]}>
          <Image source={wordmarkSource} style={styles.wordmarkImage} resizeMode="contain" />
        </Animated.View>

        <Animated.View style={[styles.dotsRow, dotsStyle]}>
          <Dot delay={0} color={dotColor} />
          <Dot delay={150} color={dotColor} />
          <Dot delay={300} color={dotColor} />
        </Animated.View>

        {message ? (
          <ThemedText variant="caption" tone="muted" style={styles.message}>
            {message}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

function Dot({ delay, color }: { delay: number; color: string }) {
  const y = useSharedValue(0);
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    y.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 550, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 550, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 550, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.4, { duration: 550, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );
    return () => {
      cancelAnimation(y);
      cancelAnimation(opacity);
    };
  }, [delay, opacity, y]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }]
  }));

  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  wrap: {
    width: Math.min(windowWidth, 320),
    alignItems: "center",
    justifyContent: "center"
  },
  glowWrap: {
    position: "absolute",
    // Align glow to the icon badge center (not the whole column including wordmark).
    top: (ICON_SIZE - GLOW_SIZE) / 2,
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    alignItems: "center",
    justifyContent: "center"
  },
  iconMask: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12
  },
  iconInner: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center"
  },
  iconImage: {
    // Match preview fill so the mark reads centered in the white circle.
    width: "82%",
    height: "82%"
  },
  wordmarkWrap: {
    marginTop: 26,
    width: 230,
    height: 48,
    alignItems: "center",
    justifyContent: "center"
  },
  wordmarkImage: {
    width: "100%",
    height: "100%"
  },
  dotsRow: {
    marginTop: 22,
    flexDirection: "row",
    gap: 8
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  message: {
    marginTop: 16,
    textAlign: "center"
  }
});

export default BrandSplashScreen;
