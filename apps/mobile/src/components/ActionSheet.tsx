import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colorWithAlpha, useTheme } from "../theme";
import { ThemedText } from "./ThemedText";

export type ActionSheetTone = "default" | "confirmed" | "destructive";

export type ActionSheetAction = {
  key: string;
  label: string;
  subtitle?: string;
  icon?: React.ReactNode;
  tone?: ActionSheetTone;
  disabled?: boolean;
  onPress: () => void;
};

type ActionSheetProps = {
  visible: boolean;
  title: string;
  message?: string;
  actions: ActionSheetAction[];
  cancelLabel?: string;
  onClose: () => void;
};

function toneColor(tone: ActionSheetTone | undefined, colors: ReturnType<typeof useTheme>["colors"]) {
  if (tone === "destructive") {
    return colors.owe;
  }
  if (tone === "confirmed") {
    return colors.confirmed;
  }
  return colors.ink;
}

export function ActionSheet({
  visible,
  title,
  message,
  actions,
  cancelLabel = "Cancel",
  onClose
}: ActionSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  function handleAction(action: ActionSheetAction) {
    if (action.disabled) {
      return;
    }
    onClose();
    // Defer so the sheet can dismiss before opening another native UI (gallery, etc.).
    requestAnimationFrame(() => {
      action.onPress();
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={onClose}
          style={[styles.backdrop, { backgroundColor: colorWithAlpha("#000000", theme.mode === "dark" ? 0.55 : 0.35) }]}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.hairline,
              paddingBottom: Math.max(insets.bottom, 16)
            }
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.colors.hairline }]} />
          <View style={styles.header}>
            <ThemedText variant="title" align="center">
              {title}
            </ThemedText>
            {message ? (
              <ThemedText variant="bodySm" tone="muted" align="center">
                {message}
              </ThemedText>
            ) : null}
          </View>

          <View style={[styles.actions, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.hairline }]}>
            {actions.map((action, index) => {
              const color = toneColor(action.tone, theme.colors);
              return (
                <Pressable
                  key={action.key}
                  disabled={action.disabled}
                  onPress={() => handleAction(action)}
                  style={({ pressed }) => [
                    styles.actionRow,
                    index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.hairline } : null,
                    pressed ? styles.pressed : null,
                    action.disabled ? styles.disabled : null
                  ]}
                >
                  {action.icon ? (
                    <View style={[styles.iconWrap, { backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline }]}>
                      {action.icon}
                    </View>
                  ) : null}
                  <View style={styles.actionCopy}>
                    <ThemedText variant="bodyMedium" style={{ color }}>
                      {action.label}
                    </ThemedText>
                    {action.subtitle ? (
                      <ThemedText variant="bodySm" tone="muted">
                        {action.subtitle}
                      </ThemedText>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancelButton,
              {
                backgroundColor: theme.colors.surfaceRaised,
                borderColor: theme.colors.hairline
              },
              pressed ? styles.pressed : null
            ]}
          >
            <ThemedText variant="button">{cancelLabel}</ThemedText>
          </Pressable>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 14
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 999,
    marginBottom: 4
  },
  header: {
    gap: 6,
    paddingHorizontal: 8,
    paddingBottom: 2
  },
  actions: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden"
  },
  actionRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  actionCopy: {
    flex: 1,
    gap: 2
  },
  cancelButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  pressed: {
    opacity: 0.82
  },
  disabled: {
    opacity: 0.45
  }
});
