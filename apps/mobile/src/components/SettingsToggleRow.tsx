import React from "react";
import { StyleSheet, Switch, View } from "react-native";

import { ThemedText } from "./ThemedText";
import { useTheme } from "../theme";

interface SettingsToggleRowProps {
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

export function SettingsToggleRow({ label, subtitle, value, onValueChange, disabled = false }: SettingsToggleRowProps) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.copy}>
        <ThemedText variant="body">{label}</ThemedText>
        {subtitle ? (
          <ThemedText variant="bodySm" tone="muted">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: theme.colors.hairline, true: theme.colors.confirmed }}
        thumbColor={theme.colors.surfaceRaised}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14
  },
  copy: {
    flex: 1,
    gap: 2,
    paddingRight: 8
  }
});
