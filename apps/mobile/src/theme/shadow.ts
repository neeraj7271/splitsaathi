import { ViewStyle } from "react-native";

/** Soft card elevation used by the light home composition. */
export function cardShadow(mode: "dark" | "light"): ViewStyle {
  if (mode === "dark") {
    return {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.28,
      shadowRadius: 8,
      elevation: 3
    };
  }

  return {
    shadowColor: "#171922",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2
  };
}
