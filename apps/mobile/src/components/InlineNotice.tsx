import React from "react";
import { StyleSheet, View } from "react-native";
import { WarningCircle } from "phosphor-react-native";

import { useTheme } from "../theme";
import { ThemedText } from "./ThemedText";

export function InlineNotice({ title, body, tone = "pending" }: { title: string; body: string; tone?: "pending" | "info" | "confirmed" | "owe" }) {
  const theme = useTheme();
  const color = theme.colors[tone];

  return (
    <View style={[styles.wrap, { borderColor: color, backgroundColor: theme.colors.surfaceRaised, borderRadius: theme.radius.md }]}>
      <WarningCircle size={20} color={color} weight="duotone" />
      <View style={styles.text}>
        <ThemedText variant="bodyMedium">{title}</ThemedText>
        <ThemedText variant="bodySm" tone="muted">
          {body}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: 10,
    borderWidth: 1,
    padding: 12
  },
  text: {
    flex: 1,
    gap: 4
  }
});
