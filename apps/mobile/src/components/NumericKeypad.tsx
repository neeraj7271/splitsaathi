import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Backspace } from "phosphor-react-native";

import { useTheme } from "../theme";
import { ThemedText } from "./ThemedText";

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "backspace"] as const;

export function NumericKeypad({ onKey }: { onKey: (key: string) => void }) {
  const theme = useTheme();

  return (
    <View style={styles.grid}>
      {keys.map((key) => (
        <Pressable
          key={key}
          onPress={() => onKey(key)}
          style={({ pressed }) => [
            styles.key,
            {
              backgroundColor: pressed ? theme.colors.surfaceRaised : "transparent",
              borderRadius: theme.radius.md
            }
          ]}
        >
          {key === "backspace" ? (
            <Backspace size={24} color={theme.colors.ink} weight="duotone" />
          ) : (
            <ThemedText variant="title" style={{ fontFamily: theme.typography.amount.fontFamily }}>
              {key}
            </ThemedText>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  key: {
    width: "33.333%",
    minHeight: 60,
    alignItems: "center",
    justifyContent: "center"
  }
});
