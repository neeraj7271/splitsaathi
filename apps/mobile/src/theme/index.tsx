import React, { createContext, useContext, useMemo, useState } from "react";
import { ColorSchemeName, useColorScheme } from "react-native";

import { chartPalette } from "./chartPalette";
import { darkColors, gradients, lightColors, ThemeColors } from "./colors";
import { motion } from "./motion";
import { radius } from "./radius";
import { spacing } from "./spacing";
import { typography } from "./typography";

export type ThemeMode = "system" | "dark" | "light";

export interface SplitSaathiTheme {
  colors: ThemeColors;
  gradients: typeof gradients;
  chartPalette: typeof chartPalette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  motion: typeof motion;
  mode: "dark" | "light";
  requestedMode: ThemeMode;
  setRequestedMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<SplitSaathiTheme | undefined>(undefined);

function resolveMode(requestedMode: ThemeMode, systemMode: ColorSchemeName): "dark" | "light" {
  if (requestedMode === "dark" || requestedMode === "light") {
    return requestedMode;
  }

  return systemMode === "light" ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemMode = useColorScheme();
  const [requestedMode, setRequestedMode] = useState<ThemeMode>("dark");
  const mode = resolveMode(requestedMode, systemMode);

  const value = useMemo<SplitSaathiTheme>(
    () => ({
      colors: mode === "dark" ? darkColors : lightColors,
      gradients,
      chartPalette,
      spacing,
      radius,
      typography,
      motion,
      mode,
      requestedMode,
      setRequestedMode
    }),
    [mode, requestedMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}

export function colorWithAlpha(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const bigint = Number.parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
