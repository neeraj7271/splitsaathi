import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { CaretRight } from "phosphor-react-native";

import { ThemedText } from "./ThemedText";
import { useTheme } from "../theme";

interface SettingsLinkRowProps {
  label: string;
  subtitle?: string;
  onPress: () => void;
}

export function SettingsLinkRow({ label, subtitle, onPress }: SettingsLinkRowProps) {
  const theme = useTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { backgroundColor: theme.colors.surface, opacity: pressed ? 0.85 : 1 }]}>
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
  copy: {
    flex: 1,
    gap: 2
  }
});
