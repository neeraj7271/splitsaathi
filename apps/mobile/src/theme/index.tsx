import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ColorSchemeName, View, useColorScheme } from "react-native";

import { chartPalette } from "./chartPalette";
import { darkColors, gradients, lightColors, ThemeColors } from "./colors";
import { cacheAppearance, loadCachedAppearance } from "./appearanceCache";
import { motion } from "./motion";
import { radius } from "./radius";
import { cardShadow } from "./shadow";
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
  cardShadow: ReturnType<typeof cardShadow>;
  mode: "dark" | "light";
  requestedMode: ThemeMode;
  /** False until local appearance cache has been read — avoid wrong-theme splash. */
  hydrated: boolean;
  setRequestedMode: (mode: ThemeMode) => void;
}

export { cardShadow };

const ThemeContext = createContext<SplitSaathiTheme | undefined>(undefined);

function resolveMode(requestedMode: ThemeMode, systemMode: ColorSchemeName): "dark" | "light" {
  if (requestedMode === "dark" || requestedMode === "light") {
    return requestedMode;
  }

  return systemMode === "light" ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemMode = useColorScheme();
  const [requestedMode, setRequestedModeState] = useState<ThemeMode>("system");
  const [hydrated, setHydrated] = useState(false);
  const mode = resolveMode(requestedMode, systemMode);

  useEffect(() => {
    let cancelled = false;
    loadCachedAppearance()
      .then((cached) => {
        if (cancelled) {
          return;
        }
        if (cached) {
          setRequestedModeState(cached);
        }
        setHydrated(true);
      })
      .catch(() => {
        if (!cancelled) {
          setHydrated(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setRequestedMode = useCallback((next: ThemeMode) => {
    setRequestedModeState(next);
    void cacheAppearance(next);
  }, []);

  const value = useMemo<SplitSaathiTheme>(
    () => ({
      colors: mode === "dark" ? darkColors : lightColors,
      gradients,
      chartPalette,
      spacing,
      radius,
      typography,
      motion,
      cardShadow: cardShadow(mode),
      mode,
      requestedMode,
      hydrated,
      setRequestedMode
    }),
    [hydrated, mode, requestedMode, setRequestedMode]
  );

  // Hold a blank frame until we know the user's saved appearance — prevents dark→light splash flash.
  if (!hydrated) {
    const bootBg = resolveMode("system", systemMode) === "light" ? lightColors.canvas : darkColors.canvas;
    return <View style={{ flex: 1, backgroundColor: bootBg }} />;
  }

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
