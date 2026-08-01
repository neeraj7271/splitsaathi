import { useMemo } from "react";
import { useWindowDimensions } from "react-native";

import { splashLayoutDefaults, splashSpacing } from "./tokens";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export type SplashGlowAnchor = {
  top: number;
  left: number;
  size: number;
};

export function useSplashLayout() {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const scale = Math.min(width / 390, height / 844, 1.12);
    const logoSize = Math.round(clamp(splashSpacing.logoSize * scale, 112, 136));
    const stageSize = Math.round(logoSize * 1.667);
    const orbitRadius = Math.round(clamp(splashLayoutDefaults.orbitRadius * scale, 92, 108));
    const maxBubble = 40;
    const heroSize = orbitRadius * 2 + maxBubble + 8;
    const glowSize = Math.round(clamp(heroSize + 28, 260, 300));

    return {
      scale,
      logoSize,
      stageSize,
      orbitRadius,
      heroSize,
      glowSize,
      width,
      height
    };
  }, [width, height]);
}

/** Match the flex-centered hero so the backdrop glow sits behind the logo. */
export function useSplashGlowAnchor(
  layout: ReturnType<typeof useSplashLayout>,
  insets: { top: number; bottom: number }
): SplashGlowAnchor {
  const { width, height, heroSize, glowSize } = layout;

  return useMemo(() => {
    const paddingTop = Math.max(insets.top, 12);
    const paddingBottom = Math.max(insets.bottom, 12) + 110;
    const availableHeight = height - paddingTop - paddingBottom;
    const blockHeight = heroSize + 188;
    const blockTop = paddingTop + Math.max(0, (availableHeight - blockHeight) / 2);
    const heroCenterY = blockTop + heroSize / 2;

    return {
      top: heroCenterY - glowSize / 2,
      left: width / 2 - glowSize / 2,
      size: glowSize
    };
  }, [glowSize, height, heroSize, insets.bottom, insets.top, width]);
}
