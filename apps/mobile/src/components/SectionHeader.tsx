import React from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "./ThemedText";

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <ThemedText variant="section" numberOfLines={1} style={styles.title}>
        {title}
      </ThemedText>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  title: {
    flex: 1,
    minWidth: 0
  },
  action: {
    flexShrink: 0
  }
});
