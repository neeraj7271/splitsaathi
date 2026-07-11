export const gradients = {
  current: {
    start: "#3730A3",
    end: "#0D9488",
    angle: 135
  },
  ember: {
    start: "#F97066",
    end: "#F59E0B",
    angle: 120
  }
} as const;

export const semanticColors = {
  receive: "#22C55E",
  owe: "#F04438",
  pending: "#F59E0B",
  confirmed: "#0D9488",
  disputed: "#F97066",
  info: "#6366F1"
} as const;

export const darkColors = {
  mode: "dark",
  canvas: "#0B0E14",
  surface: "#12151D",
  surfaceRaised: "#191D27",
  hairline: "#232836",
  ink: "#F4F5F7",
  inkMuted: "#9AA1AF",
  inkFaint: "#5B6273",
  neutralChipBg: "#1E2330",
  ...semanticColors
} as const;

export const lightColors = {
  mode: "light",
  canvas: "#F6F7FB",
  surface: "#FFFFFF",
  surfaceRaised: "#FCFCFE",
  hairline: "#E4E7EF",
  ink: "#171922",
  inkMuted: "#5B6273",
  inkFaint: "#9AA1AF",
  neutralChipBg: "#EEF0F6",
  ...semanticColors
} as const;

export type ThemeColors = typeof darkColors | typeof lightColors;
