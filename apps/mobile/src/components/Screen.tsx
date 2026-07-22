import React from "react";
import { RefreshControl, ScrollView, StatusBar, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme";

const TAB_BAR_HEIGHT = 64;

export function Screen({
  children,
  scroll = true,
  footer,
  refreshing,
  onRefresh
}: {
  children: React.ReactNode;
  scroll?: boolean;
  footer?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const paddingTop = Math.max(48, insets.top + 16);
  const paddingBottom = Math.max(24, insets.bottom + 16);
  const scrollBottomPadding = paddingBottom + TAB_BAR_HEIGHT;

  const content = (
    <View
      style={[
        styles.content,
        {
          paddingHorizontal: theme.spacing.screen,
          gap: theme.spacing.sectionGap,
          paddingTop,
          paddingBottom
        }
      ]}
    >
      {children}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <StatusBar barStyle={theme.mode === "dark" ? "light-content" : "dark-content"} />
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={Boolean(refreshing)}
                onRefresh={onRefresh}
                tintColor={theme.colors.confirmed}
                colors={[theme.colors.confirmed]}
              />
            ) : undefined
          }
        >
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
  content: {
    flexGrow: 1
  }
});
