import React from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "../theme";
import { ThemedText } from "./ThemedText";

export function DetailRow({ label, value }: { label: string; value?: string }) {
  const theme = useTheme();
  if (!value?.trim()) {
    return null;
  }
  return (
    <View style={[styles.row, { borderBottomColor: theme.colors.hairline }]}>
      <ThemedText variant="bodySm" tone="muted">
        {label}
      </ThemedText>
      <ThemedText variant="bodyMedium" style={styles.value}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 4,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  value: {
    flexShrink: 1
  }
});
