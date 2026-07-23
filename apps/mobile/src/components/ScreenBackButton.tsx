import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { CaretLeft } from "phosphor-react-native";

import { useTheme } from "../theme";
import { AppNavigation } from "../types/navigation";
import { ThemedText } from "./ThemedText";

export function ScreenBackButton({
  navigation,
  label = "Back",
  fallbackRoute = "home"
}: {
  navigation: AppNavigation;
  label?: string;
  fallbackRoute?: Parameters<AppNavigation["go"]>[0];
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => {
        if (!navigation.back()) {
          navigation.go(fallbackRoute);
        }
      }}
      style={styles.row}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.icon, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.surfaceRaised }]}>
        <CaretLeft size={18} color={theme.colors.ink} weight="bold" />
      </View>
      <ThemedText variant="bodySm" tone="muted">
        {label}
      </ThemedText>
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
  icon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  }
});
