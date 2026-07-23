import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { CheckCircle, WarningCircle, Info, XCircle } from "phosphor-react-native";

import { colorWithAlpha, useTheme } from "../theme";
import { Button } from "./Button";
import { ThemedText } from "./ThemedText";

export type AppDialogTone = "info" | "success" | "warning" | "error";

export type AppDialogAction = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "destructive" | "ghost";
};

export type AppDialogOptions = {
  title: string;
  message?: string;
  tone?: AppDialogTone;
  primaryAction?: AppDialogAction;
  secondaryAction?: AppDialogAction;
};

type AppDialogContextValue = {
  showDialog: (options: AppDialogOptions) => void;
  hideDialog: () => void;
};

const AppDialogContext = createContext<AppDialogContextValue | null>(null);

function toneIcon(tone: AppDialogTone, color: string) {
  const props = { size: 28, color, weight: "duotone" as const };
  switch (tone) {
    case "success":
      return <CheckCircle {...props} />;
    case "warning":
      return <WarningCircle {...props} />;
    case "error":
      return <XCircle {...props} />;
    default:
      return <Info {...props} />;
  }
}

function toneAccent(tone: AppDialogTone, colors: ReturnType<typeof useTheme>["colors"]) {
  switch (tone) {
    case "success":
      return colors.confirmed;
    case "warning":
      return colors.pending;
    case "error":
      return colors.owe;
    default:
      return colors.info;
  }
}

export function AppDialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<AppDialogOptions | null>(null);

  const hideDialog = useCallback(() => setDialog(null), []);
  const showDialog = useCallback((options: AppDialogOptions) => setDialog(options), []);

  const value = useMemo(() => ({ showDialog, hideDialog }), [showDialog, hideDialog]);

  return (
    <AppDialogContext.Provider value={value}>
      {children}
      <AppDialogModal dialog={dialog} onClose={hideDialog} />
    </AppDialogContext.Provider>
  );
}

export function useAppDialog() {
  const ctx = useContext(AppDialogContext);
  if (!ctx) {
    throw new Error("useAppDialog must be used within AppDialogProvider");
  }
  return ctx;
}

/** Safe helper when a provider may be unavailable (e.g. early boot). */
export function useOptionalAppDialog() {
  return useContext(AppDialogContext);
}

function AppDialogModal({ dialog, onClose }: { dialog: AppDialogOptions | null; onClose: () => void }) {
  const theme = useTheme();
  const visible = Boolean(dialog);
  const tone = dialog?.tone ?? "info";
  const accent = toneAccent(tone, theme.colors);

  function runAction(action?: AppDialogAction) {
    onClose();
    if (action?.onPress) {
      requestAnimationFrame(() => action.onPress?.());
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog"
          onPress={onClose}
          style={[styles.backdrop, { backgroundColor: colorWithAlpha("#0B0E14", theme.mode === "dark" ? 0.72 : 0.45) }]}
        />
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.hairline,
              borderRadius: theme.radius.lg
            }
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: colorWithAlpha(accent, 0.14) }]}>
            {toneIcon(tone, accent)}
          </View>
          <ThemedText variant="title" align="center">
            {dialog?.title}
          </ThemedText>
          {dialog?.message ? (
            <ThemedText variant="body" tone="muted" align="center" style={styles.message}>
              {dialog.message}
            </ThemedText>
          ) : null}
          <View style={styles.actions}>
            {dialog?.secondaryAction ? (
              <Button
                label={dialog.secondaryAction.label}
                variant={dialog.secondaryAction.variant ?? "secondary"}
                onPress={() => runAction(dialog.secondaryAction)}
                style={styles.actionButton}
              />
            ) : null}
            <Button
              label={dialog?.primaryAction?.label ?? "OK"}
              variant={dialog?.primaryAction?.variant ?? "primary"}
              onPress={() => runAction(dialog?.primaryAction)}
              style={styles.actionButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject
  },
  card: {
    zIndex: 1,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    gap: 10,
    alignItems: "center"
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4
  },
  message: {
    marginBottom: 4
  },
  actions: {
    width: "100%",
    gap: 8,
    marginTop: 8
  },
  actionButton: {
    width: "100%"
  }
});
