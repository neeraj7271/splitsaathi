import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { CaretRight } from "phosphor-react-native";

import { ThemedText } from "./ThemedText";
import { colorWithAlpha, useTheme } from "../theme";
import { semanticColors } from "../theme/colors";

interface SettingsLinkRowProps {
  label: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconTone?: keyof typeof semanticColors;
  onPress: () => void;
}

export function SettingsLinkRow({ label, subtitle, icon, iconTone = "info", onPress }: SettingsLinkRowProps) {
  const theme = useTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { backgroundColor: theme.colors.surface, opacity: pressed ? 0.85 : 1 }]}>
      {icon ? (
        <View style={[styles.iconContainer, { backgroundColor: colorWithAlpha(theme.colors[iconTone], 0.15) }]}>
          {icon}
        </View>
      ) : null}
      <View style={styles.copy}>
        <ThemedText variant="body">{label}</ThemedText>
        {subtitle ? (
          <ThemedText variant="bodySm" tone="muted">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <CaretRight size={18} color={theme.colors.inkMuted} />
    </Pressable>
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
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  copy: {
    flex: 1,
    gap: 2
  }
});
