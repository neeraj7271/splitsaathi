import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useTheme } from "../theme";
import { ThemedText } from "./ThemedText";

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange
}: {
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: theme.colors.surfaceRaised, borderRadius: theme.radius.full }]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              {
                borderRadius: theme.radius.full,
                backgroundColor: active ? theme.colors.surface : "transparent",
                borderColor: active ? theme.colors.hairline : "transparent"
              }
            ]}
          >
            <ThemedText variant="caption" tone={active ? "ink" : "muted"}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 44,
    flexDirection: "row",
    padding: 4
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1
  }
});
