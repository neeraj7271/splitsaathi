import React from "react";
import { ScrollView, StatusBar, StyleSheet, View } from "react-native";

import { useTheme } from "../theme";

export function Screen({
  children,
  scroll = true,
  footer
}: {
  children: React.ReactNode;
  scroll?: boolean;
  footer?: React.ReactNode;
}) {
  const theme = useTheme();
  const content = <View style={[styles.content, { paddingHorizontal: theme.spacing.screen, gap: theme.spacing.sectionGap }]}>{children}</View>;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <StatusBar barStyle={theme.mode === "dark" ? "light-content" : "dark-content"} />
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  scroll: {
    paddingBottom: 112
  },
  content: {
    paddingTop: 56,
    paddingBottom: 24
  }
});
