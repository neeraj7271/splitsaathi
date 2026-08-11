import React from "react";
import { StyleSheet, View } from "react-native";

import { colorWithAlpha, useTheme } from "../theme";
import { ThemedText } from "./ThemedText";
import { getStatusPillPresentation, type StatusPillState } from "./statusPillPresentation";

export function StatusPill({ state }: { state: StatusPillState }) {
  const theme = useTheme();
  const { color, bg, label } = getStatusPillPresentation(state, theme.colors);

  return (
    <View style={[styles.pill, { borderRadius: 999, backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <ThemedText variant="caption" numberOfLines={1} style={{ color, fontWeight: "600", fontSize: 12 }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999
  }
});
