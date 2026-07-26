import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";

import { colorWithAlpha, useTheme } from "../theme";
import { ThemedText } from "./ThemedText";

type IconComponent = React.ComponentType<{ size?: number; color?: string; weight?: "duotone" | "bold" | "regular" | "fill" }>;

export interface QuickAction {
  label: string;
  icon: IconComponent;
  onPress: () => void;
  /** Accent used for the soft icon well. */
  tint?: string;
}

export function QuickActionGrid({ actions }: { actions: QuickAction[] }) {
  const theme = useTheme();

  return (
    <View style={styles.grid}>
      {actions.map((action) => {
        const Icon = action.icon;
        const tint = action.tint ?? theme.colors.info;
        return (
          <Pressable
            key={action.label}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              action.onPress();
            }}
            style={styles.item}
          >
            <View
              style={[
                styles.well,
                {
                  backgroundColor: colorWithAlpha(tint, theme.mode === "dark" ? 0.22 : 0.12),
                  borderRadius: theme.radius.md
                }
              ]}
            >
              <Icon size={22} color={tint} weight="duotone" />
            </View>
            <ThemedText variant="caption" align="center" numberOfLines={2}>
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
    gap: 4
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 6
  },
  well: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center"
  }
});
