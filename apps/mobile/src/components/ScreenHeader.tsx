import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

import { AppNavigation, AppRoute } from "../types/navigation";
import { ScreenBackButton } from "./ScreenBackButton";
import { ThemedText } from "./ThemedText";

export function ScreenHeader({
  navigation,
  fallbackRoute = "home",
  title,
  subtitle,
  caption,
  captionTone = "muted",
  trailing,
  showBack = true,
  backLabel = "",
  titleContent,
  style
}: {
  navigation: AppNavigation;
  fallbackRoute?: AppRoute;
  title?: string;
  subtitle?: string;
  caption?: string;
  captionTone?: "muted" | "confirmed";
  trailing?: React.ReactNode;
  showBack?: boolean;
  backLabel?: string;
  titleContent?: React.ReactNode;
  style?: ViewStyle;
}) {
  const hasTitleBlock = Boolean(titleContent || caption || title || subtitle);

  return (
    <View style={[styles.bar, style]}>
      {showBack ? (
        <ScreenBackButton navigation={navigation} label={backLabel} fallbackRoute={fallbackRoute} embedded />
      ) : null}
      {hasTitleBlock ? (
        <View style={styles.copy}>
          {titleContent ?? (
            <>
              {caption ? (
                <ThemedText variant="caption" tone={captionTone} numberOfLines={1}>
                  {caption}
                </ThemedText>
              ) : null}
              {title ? (
                <ThemedText variant="title" numberOfLines={caption ? 1 : 2}>
                  {title}
                </ThemedText>
              ) : null}
              {subtitle ? (
                <ThemedText variant="bodySm" tone="muted" numberOfLines={2}>
                  {subtitle}
                </ThemedText>
              ) : null}
            </>
          )}
        </View>
      ) : (
        <View style={styles.spacer} />
      )}
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  spacer: {
    flex: 1
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0
  }
});
