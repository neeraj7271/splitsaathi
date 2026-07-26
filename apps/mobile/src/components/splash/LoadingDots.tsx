import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";

import type { SplashPalette } from "./tokens";
import { splashTimeline } from "./tokens";

type Props = {
  palette: SplashPalette;
  reduceMotion: boolean;
  /** Dark mockup: first active. Light mockup: middle active. */
  activeIndex?: 0 | 1 | 2;
};

export function LoadingDots({ palette, reduceMotion, activeIndex = 0 }: Props) {
  const visible = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      visible.value = 1;
      return;
    }
    visible.value = withDelay(
      splashTimeline.dotsStart,
      withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) })
    );
    return () => cancelAnimation(visible);
  }, [reduceMotion, visible]);

  const rowStyle = useAnimatedStyle(() => ({
    opacity: visible.value
  }));

  return (
    <Animated.View
      style={[styles.row, rowStyle]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    >
      {[0, 1, 2].map((index) => (
        <Dot
          key={index}
          color={index === activeIndex ? palette.dotsActive : palette.dotsIdle}
          active={index === activeIndex}
          delay={index * 160}
          reduceMotion={reduceMotion}
        />
      ))}
    </Animated.View>
  );
}

function Dot({
  color,
  active,
  delay,
  reduceMotion
}: {
  color: string;
  active: boolean;
  delay: number;
  reduceMotion: boolean;
}) {
  const scale = useSharedValue(active ? 1 : 0.85);
  const opacity = useSharedValue(active ? 1 : 0.55);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    scale.value = withDelay(
      splashTimeline.dotsStart + delay,
      withRepeat(
        withSequence(
          withTiming(active ? 1.25 : 1, { duration: 450, easing: Easing.inOut(Easing.sin) }),
          withTiming(active ? 1 : 0.85, { duration: 450, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );
    opacity.value = withDelay(
      splashTimeline.dotsStart + delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 450, easing: Easing.inOut(Easing.sin) }),
          withTiming(active ? 0.75 : 0.4, { duration: 450, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );
    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [active, delay, opacity, reduceMotion, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }]
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          backgroundColor: color,
          width: active ? 9 : 7,
          height: active ? 9 : 7,
          borderRadius: active ? 5 : 4
        },
        style
      ]}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    minHeight: 12
  },
  dot: {}
});
