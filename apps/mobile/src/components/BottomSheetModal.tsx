import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View, ViewStyle } from "react-native";
import { X } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colorWithAlpha, useTheme } from "../theme";
import { ThemedText } from "./ThemedText";

export type BottomSheetModalProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxHeight?: ViewStyle["maxHeight"];
  scrollable?: boolean;
};

export function BottomSheetModal({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxHeight = "88%",
  scrollable = true
}: BottomSheetModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const horizontalPadding = theme.spacing.screen;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={onClose}
          style={[styles.backdrop, { backgroundColor: colorWithAlpha("#000000", theme.mode === "dark" ? 0.56 : 0.4) }]}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.canvas,
              borderTopLeftRadius: theme.radius.lg,
              borderTopRightRadius: theme.radius.lg,
              paddingBottom: Math.max(insets.bottom, theme.spacing.md),
              maxHeight
            }
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: theme.colors.hairline }]} />
          </View>
          <View style={[styles.header, { paddingHorizontal: horizontalPadding }]}>
            <View style={styles.headerCopy}>
              <ThemedText variant="title">{title}</ThemedText>
              {subtitle ? (
                <ThemedText variant="bodySm" tone="muted" numberOfLines={2}>
                  {subtitle}
                </ThemedText>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={[
                styles.closeButton,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline }
              ]}
            >
              <X size={20} color={theme.colors.ink} weight="bold" />
            </Pressable>
          </View>
          {scrollable ? (
            <ScrollView
              contentContainerStyle={[
                styles.content,
                {
                  gap: theme.spacing.md,
                  paddingHorizontal: horizontalPadding,
                  paddingBottom: theme.spacing.sm
                }
              ]}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : (
            <View
              style={[
                styles.content,
                {
                  gap: theme.spacing.md,
                  paddingHorizontal: horizontalPadding,
                  paddingBottom: theme.spacing.sm
                }
              ]}
            >
              {children}
            </View>
          )}
          {footer ? (
            <View style={[styles.footer, { paddingHorizontal: horizontalPadding, gap: theme.spacing.xs }]}>
              {footer}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end"
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject
  },
  sheet: {
    gap: 12
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: 10
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 999
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  headerCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  content: {},
  footer: {}
});
