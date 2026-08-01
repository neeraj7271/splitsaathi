import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import {
  ChartBar,
  ChartPie,
  Coins,
  CreditCard,
  CurrencyInr,
  Receipt,
  UsersThree,
  Wallet
} from "phosphor-react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming
} from "react-native-reanimated";

import type { SplashPalette } from "./tokens";
import { splashLayoutDefaults, splashTimeline } from "./tokens";

const ORBIT_RADIUS = splashLayoutDefaults.orbitRadius;

type IconComponent = React.ComponentType<{
  size?: number;
  color?: string;
  weight?: "duotone" | "regular" | "bold" | "fill";
}>;

type OrbitIcon = {
  id: string;
  Icon: IconComponent;
  size: number;
  bubble: number;
};

/** Single orbit set for both themes (light-mode layout). */
const ORBIT_ICONS: OrbitIcon[] = [
  { id: "wallet", Icon: Wallet, size: 16, bubble: 38 },
  { id: "receipt", Icon: Receipt, size: 15, bubble: 36 },
  { id: "inr", Icon: CurrencyInr, size: 17, bubble: 40 },
  { id: "card", Icon: CreditCard, size: 15, bubble: 36 },
  { id: "bars", Icon: ChartBar, size: 15, bubble: 36 },
  { id: "coins", Icon: Coins, size: 16, bubble: 38 },
  { id: "pie", Icon: ChartPie, size: 15, bubble: 36 },
  { id: "group", Icon: UsersThree, size: 16, bubble: 38 }
];

const ORBIT_MS = 22000;

type Props = {
  palette: SplashPalette;
  reduceMotion: boolean;
  orbitRadius?: number;
};

export function FloatingIcons({ palette, reduceMotion, orbitRadius = ORBIT_RADIUS }: Props) {
  const orbit = useSharedValue(0);
  const ringOpacity = useSharedValue(0);

  const slots = useMemo(() => {
    const step = 360 / ORBIT_ICONS.length;
    return ORBIT_ICONS.map((icon, index) => ({
      ...icon,
      baseAngle: -90 + index * step
    }));
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      ringOpacity.value = palette.floatOpacity;
      orbit.value = 0;
      return;
    }

    ringOpacity.value = withDelay(
      splashTimeline.floatStart,
      withTiming(palette.floatOpacity, { duration: 700, easing: Easing.out(Easing.cubic) })
    );

    orbit.value = withDelay(
      splashTimeline.floatStart,
      withRepeat(withTiming(360, { duration: ORBIT_MS, easing: Easing.linear }), -1, false)
    );

    return () => {
      cancelAnimation(orbit);
      cancelAnimation(ringOpacity);
    };
  }, [orbit, palette.floatOpacity, reduceMotion, ringOpacity]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ rotate: `${orbit.value}deg` }]
  }));

  const counterStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-orbit.value}deg` }]
  }));

  return (
    <View style={styles.stage} pointerEvents="none">
      <Animated.View
        style={[
          styles.ring,
          ringStyle,
          {
            width: orbitRadius * 2 + 48,
            height: orbitRadius * 2 + 48
          }
        ]}
      >
        {slots.map((slot) => (
          <OrbitBubble
            key={slot.id}
            icon={slot}
            baseAngle={slot.baseAngle}
            palette={palette}
            counterStyle={counterStyle}
            orbitRadius={orbitRadius}
          />
        ))}
      </Animated.View>
    </View>
  );
}

function OrbitBubble({
  icon,
  baseAngle,
  palette,
  counterStyle,
  orbitRadius
}: {
  icon: OrbitIcon;
  baseAngle: number;
  palette: SplashPalette;
  counterStyle: ReturnType<typeof useAnimatedStyle>;
  orbitRadius: number;
}) {
  const Icon = icon.Icon;
  const rad = (baseAngle * Math.PI) / 180;
  const x = Math.cos(rad) * orbitRadius;
  const y = Math.sin(rad) * orbitRadius;

  return (
    <View
      style={[
        styles.bubbleAnchor,
        {
          width: icon.bubble,
          height: icon.bubble,
          marginLeft: -icon.bubble / 2 + x,
          marginTop: -icon.bubble / 2 + y
        }
      ]}
    >
      <Animated.View
        style={[
          styles.bubble,
          {
            width: icon.bubble,
            height: icon.bubble,
            borderRadius: icon.bubble / 2,
            backgroundColor: palette.floatBubbleBg,
            borderColor: palette.floatBubbleBorder,
            shadowColor: palette.mode === "dark" ? "#6366F1" : "#94A3B8",
            shadowOpacity: palette.mode === "dark" ? 0.35 : 0.12,
            shadowRadius: palette.mode === "dark" ? 10 : 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 4
          },
          counterStyle
        ]}
      >
        <Icon size={icon.size} color={palette.floatIcon} weight="duotone" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center"
  },
  ring: {
    alignItems: "center",
    justifyContent: "center"
  },
  bubbleAnchor: {
    position: "absolute",
    top: "50%",
    left: "50%"
  },
  bubble: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1
  }
});
