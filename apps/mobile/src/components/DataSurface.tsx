import React from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "../theme";

export function DataSurface({ children }: { children: React.ReactNode }) {
  const theme = useTheme();

  return <View style={[styles.surface, { backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline, borderRadius: theme.radius.md }]}>{children}</View>;
}

const styles = StyleSheet.create({
  surface: {
    borderWidth: 1,
    overflow: "hidden"
  }
});
