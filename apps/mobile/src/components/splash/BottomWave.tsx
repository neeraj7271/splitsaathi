import React, { useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

import type { SplashPalette } from "./tokens";
import { TEAL } from "./tokens";

const { width: W } = Dimensions.get("window");

type Props = {
  palette: SplashPalette;
  reduceMotion: boolean;
};

export function BottomWave({ palette, reduceMotion }: Props) {
  const shift = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    shift.value = withRepeat(
      withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    return () => cancelAnimation(shift);
  }, [reduceMotion, shift]);

  const layer1 = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shift.value, [0, 1], [0, -8]) }]
  }));
  const layer2 = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shift.value, [0, 1], [0, 6]) }]
  }));
  const layer3 = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shift.value, [0, 1], [0, -4]) }]
  }));

  const width = W + 48;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <LineArt stroke={palette.lineArt} accent={TEAL} />

      <Animated.View style={[styles.layer, layer1]}>
        <WavePath width={width} color={palette.waveColors[0]} opacity={palette.waveOpacities[0]} variant={0} />
      </Animated.View>
      <Animated.View style={[styles.layer, layer2]}>
        <WavePath width={width} color={palette.waveColors[1]} opacity={palette.waveOpacities[1]} variant={1} />
      </Animated.View>
      <Animated.View style={[styles.layer, layer3]}>
        <WavePath width={width} color={palette.waveColors[2]} opacity={palette.waveOpacities[2]} variant={2} />
      </Animated.View>
    </View>
  );
}

function WavePath({
  width,
  color,
  opacity,
  variant
}: {
  width: number;
  color: string;
  opacity: number;
  variant: number;
}) {
  const height = 100 + variant * 12;
  const d =
    variant === 0
      ? `M0,48 C${width * 0.2},18 ${width * 0.4},78 ${width * 0.62},42 C${width * 0.8},18 ${width * 0.92},58 ${width},44 L${width},${height} L0,${height} Z`
      : variant === 1
        ? `M0,56 C${width * 0.18},82 ${width * 0.4},28 ${width * 0.6},58 C${width * 0.78},84 ${width * 0.9},36 ${width},52 L${width},${height} L0,${height} Z`
        : `M0,62 C${width * 0.25},38 ${width * 0.48},78 ${width * 0.7},48 C${width * 0.88},28 ${width * 0.96},64 ${width},56 L${width},${height} L0,${height} Z`;

  return (
    <Svg width={width} height={height} style={styles.svg}>
      <Path d={d} fill={color} opacity={opacity} />
    </Svg>
  );
}

function LineArt({ stroke, accent }: { stroke: string; accent: string }) {
  const left = 28;
  const right = W - 36;

  return (
    <Svg width={W} height={78} style={styles.lineArt} viewBox={`0 0 ${W} 78`}>
      {/* Three friends + phone */}
      <Circle cx={left + 8} cy={22} r={5.5} stroke={stroke} strokeWidth={1.3} fill="none" />
      <Circle cx={left + 26} cy={20} r={5.5} stroke={stroke} strokeWidth={1.3} fill="none" />
      <Circle cx={left + 44} cy={22} r={5.5} stroke={stroke} strokeWidth={1.3} fill="none" />
      <Path d={`M${left} 40 C${left + 4} 30 ${left + 12} 30 ${left + 16} 40`} stroke={stroke} strokeWidth={1.3} fill="none" />
      <Path d={`M${left + 18} 38 C${left + 22} 28 ${left + 30} 28 ${left + 34} 38`} stroke={stroke} strokeWidth={1.3} fill="none" />
      <Path d={`M${left + 36} 40 C${left + 40} 30 ${left + 48} 30 ${left + 52} 40`} stroke={stroke} strokeWidth={1.3} fill="none" />
      <Path
        d={`M${left + 22} 42 L${left + 34} 42 L${left + 34} 52 L${left + 22} 52 Z`}
        stroke={stroke}
        strokeWidth={1.2}
        fill="none"
      />

      {/* Dashed arrow to wallet */}
      <Path
        d={`M${left + 58} 46 C${W * 0.38} 22, ${W * 0.55} 68, ${right - 58} 42`}
        stroke={stroke}
        strokeWidth={1.3}
        strokeDasharray="5 4"
        fill="none"
      />
      <Path
        d={`M${right - 64} 38 L${right - 56} 42 L${right - 64} 46`}
        stroke={stroke}
        strokeWidth={1.3}
        fill="none"
        strokeLinejoin="round"
      />

      {/* Wallet */}
      <Path
        d={`M${right - 52} 28 L${right - 12} 28 L${right - 12} 54 L${right - 52} 54 Z`}
        stroke={stroke}
        strokeWidth={1.3}
        fill="none"
      />
      <Path d={`M${right - 52} 36 L${right - 12} 36`} stroke={stroke} strokeWidth={1.1} />
      <Path d={`M${right - 52} 42 L${right - 12} 42`} stroke={stroke} strokeWidth={1.1} />
      <Circle cx={right - 4} cy={40} r={8} stroke={accent} strokeWidth={1.3} fill="none" />
      <Path
        d={`M${right - 7} 37 L${right - 1} 37 M${right - 4} 37 L${right - 4} 44 M${right - 7} 44 L${right - 1} 44`}
        stroke={accent}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 150,
    justifyContent: "flex-end",
    overflow: "hidden"
  },
  layer: {
    position: "absolute",
    bottom: 0,
    left: 0
  },
  svg: {
    marginLeft: -16
  },
  lineArt: {
    position: "absolute",
    bottom: 58,
    left: 0
  }
});
