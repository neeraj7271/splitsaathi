import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";

import { useTheme } from "../theme";
import { ThemedText } from "./ThemedText";

type IconComponent = React.ComponentType<{ size?: number; color?: string; weight?: "duotone" | "bold" | "regular" }>;

export interface QuickAction {
  label: string;
  icon: IconComponent;
  onPress: () => void;
}

export function QuickActionGrid({ actions }: { actions: QuickAction[] }) {
  const theme = useTheme();

  return (
    <View style={styles.grid}>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Pressable
            key={action.label}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              action.onPress();
            }}
            style={styles.item}
          >
            <View style={[styles.circle, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.hairline }]}>
              <Icon size={22} color={theme.colors.ink} weight="duotone" />
            </View>
            <ThemedText variant="caption" align="center">
              {action.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 8
  },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1
  }
});
