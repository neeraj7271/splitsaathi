import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { useTheme } from "../theme";

export function DataSurface({
  children,
  elevated = false,
  padded = false,
  style
}: {
  children: React.ReactNode;
  elevated?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.surface,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.hairline,
          borderRadius: theme.radius.md,
          borderWidth: elevated && theme.mode === "light" ? 0 : 1,
          padding: padded ? theme.spacing.cardPadding : 0,
          overflow: elevated ? "visible" : "hidden"
        },
        elevated ? theme.cardShadow : null,
        style
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {}
});
