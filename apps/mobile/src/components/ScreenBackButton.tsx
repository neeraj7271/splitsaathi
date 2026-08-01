import React from "react";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { CaretLeft } from "phosphor-react-native";

import { useTheme } from "../theme";
import { AppNavigation } from "../types/navigation";
import { ThemedText } from "./ThemedText";

export function ScreenBackButton({
  navigation,
  label = "Back",
  fallbackRoute = "home",
  embedded = false,
  style
}: {
  navigation: AppNavigation;
  label?: string;
  fallbackRoute?: Parameters<AppNavigation["go"]>[0];
  embedded?: boolean;
  style?: ViewStyle;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => {
        if (!navigation.back()) {
          navigation.go(fallbackRoute);
        }
      }}
      style={[styles.row, embedded ? styles.rowEmbedded : null, style]}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label || "Back"}
    >
      <View style={[styles.icon, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.surfaceRaised }]}>
        <CaretLeft size={18} color={theme.colors.ink} weight="bold" />
      </View>
      {label ? (
        <ThemedText variant="bodySm" tone="muted">
          {label}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    marginBottom: 4
  },
  rowEmbedded: {
    marginBottom: 0,
    alignSelf: "center",
    flexShrink: 0
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  }
});
