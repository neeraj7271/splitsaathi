export const TEAL = "#14B8A6";
export const PURPLE = "#7C3AED";

export const splashSpacing = {
  logoSize: 132,
  logoToTitle: 22,
  titleToTagline: 10,
  taglineToDots: 28
} as const;

export const splashTimeline = {
  floatStart: 250,
  logoStart: 400,
  glowStart: 800,
  nameStart: 1000,
  taglineStart: 1300,
  dotsStart: 1700
} as const;

/** Shared copy — same layout for light and dark. */
export const SPLASH_TAGLINE = "Split Smarter.\nLive Better.";

export type SplashMode = "dark" | "light";

export type SplashPalette = {
  mode: SplashMode;
  gradient: readonly [string, string, string, string];
  gradientLocations: readonly [number, number, number, number];
  centerGlow: string;
  starColors: readonly string[];
  textSecondary: string;
  floatBubbleBg: string;
  floatBubbleBorder: string;
  floatIcon: string;
  floatOpacity: number;
  orbitRing: string;
  dotsActive: string;
  dotsIdle: string;
  waveColors: readonly [string, string, string];
  waveOpacities: readonly [number, number, number];
  lineArt: string;
  dividerTrack: string;
  logoShadow: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  };
};

/** Same UI as light splash — only surface colors change. */
export const splashLightPalette: SplashPalette = {
  mode: "light",
  gradient: ["#FFFFFF", "#F5F8FF", "#EEF4FF", "#E8F7F5"],
  gradientLocations: [0, 0.35, 0.7, 1],
  centerGlow: "rgba(99,102,241,0.1)",
  starColors: ["#93C5FD", "#C4B5FD", "#99F6E4"],
  textSecondary: "#64748B",
  floatBubbleBg: "rgba(255,255,255,0.92)",
  floatBubbleBorder: "rgba(226,232,240,0.9)",
  floatIcon: "#64748B",
  floatOpacity: 0.75,
  orbitRing: "rgba(148,163,184,0.18)",
  dotsActive: PURPLE,
  dotsIdle: "rgba(167,139,250,0.35)",
  waveColors: ["#7DD3FC", "#99F6E4", "#C4B5FD"],
  waveOpacities: [0.45, 0.35, 0.28],
  lineArt: "rgba(100,116,139,0.45)",
  dividerTrack: "rgba(148,163,184,0.25)",
  logoShadow: {
    shadowColor: "#64748B",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10
  }
};

/** Identical layout to light — dark canvas / ink / wave tones only. */
export const splashDarkPalette: SplashPalette = {
  mode: "dark",
  gradient: ["#07111F", "#0B1F3A", "#12204A", "#0A1628"],
  gradientLocations: [0, 0.35, 0.7, 1],
  centerGlow: "rgba(99,102,241,0.18)",
  starColors: ["#93C5FD", "#C4B5FD", "#5EEAD4"],
  textSecondary: "rgba(226,232,240,0.78)",
  floatBubbleBg: "rgba(255,255,255,0.08)",
  floatBubbleBorder: "rgba(255,255,255,0.16)",
  floatIcon: "rgba(226,232,240,0.72)",
  floatOpacity: 0.85,
  orbitRing: "rgba(255,255,255,0.14)",
  dotsActive: PURPLE,
  dotsIdle: "rgba(167,139,250,0.35)",
  waveColors: ["#1E3A5F", "#0F766E", "#5B21B6"],
  waveOpacities: [0.45, 0.35, 0.28],
  lineArt: "rgba(226,232,240,0.45)",
  dividerTrack: "rgba(255,255,255,0.16)",
  logoShadow: {
    shadowColor: "#6366F1",
    shadowOpacity: 0.35,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14
  }
};
