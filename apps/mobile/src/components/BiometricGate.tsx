import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../api/client";
import { BrandLogo } from "./BrandLogo";
import { Button } from "./Button";
import { ThemedText } from "./ThemedText";
import { useTheme } from "../theme";

type Props = {
  children: React.ReactNode;
  enabled: boolean;
};

/**
 * When biometricAuthEnabled is on, require device biometrics/PIN after cold start
 * and when returning from background past sessionTimeoutSeconds.
 */
export function BiometricGate({ children, enabled }: Props) {
  const theme = useTheme();
  const preferencesQuery = useQuery({
    queryKey: ["preferences"],
    queryFn: () => apiClient.getPreferences(),
    enabled
  });
  const biometricOn = Boolean(preferencesQuery.data?.biometricAuthEnabled);
  const timeoutSeconds = preferencesQuery.data?.sessionTimeoutSeconds ?? 0;
  const [unlocked, setUnlocked] = useState(!biometricOn);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const lastBackgroundAt = useRef<number | null>(null);
  const prompting = useRef(false);

  const unlock = useCallback(async () => {
    if (prompting.current) {
      return;
    }
    prompting.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!compatible || !enrolled) {
        // No biometrics enrolled — allow through with device PIN if available, else unlock
        const pin = await LocalAuthentication.authenticateAsync({
          promptMessage: "Unlock SplitSaathi",
          fallbackLabel: "Use device passcode",
          cancelLabel: "Cancel",
          disableDeviceFallback: false
        });
        if (pin.success) {
          setUnlocked(true);
        } else {
          setError("Authentication required to open SplitSaathi.");
          setUnlocked(false);
        }
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock SplitSaathi",
        fallbackLabel: "Use device passcode",
        cancelLabel: "Cancel",
        disableDeviceFallback: false
      });
      if (result.success) {
        setUnlocked(true);
      } else {
        setUnlocked(false);
        setError("Could not verify your identity. Try again.");
      }
    } catch (err) {
      setUnlocked(false);
      setError(err instanceof Error ? err.message : "Biometric unlock failed.");
    } finally {
      setBusy(false);
      prompting.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled || preferencesQuery.isLoading) {
      return;
    }
    if (!biometricOn) {
      setUnlocked(true);
      return;
    }
    setUnlocked(false);
    void unlock();
  }, [enabled, biometricOn, preferencesQuery.isLoading, unlock]);

  useEffect(() => {
    if (!enabled || !biometricOn) {
      return;
    }
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background" || next === "inactive") {
        lastBackgroundAt.current = Date.now();
        return;
      }
      if (next !== "active") {
        return;
      }
      const leftAt = lastBackgroundAt.current;
      lastBackgroundAt.current = null;
      if (leftAt == null) {
        return;
      }
      const elapsedSec = (Date.now() - leftAt) / 1000;
      // timeoutSeconds === 0 means always re-lock when returning from background
      if (timeoutSeconds === 0 || elapsedSec >= timeoutSeconds) {
        setUnlocked(false);
        void unlock();
      }
    });
    return () => sub.remove();
  }, [enabled, biometricOn, timeoutSeconds, unlock]);

  if (!enabled || !biometricOn || unlocked) {
    return <>{children}</>;
  }

  return (
    <View style={[styles.lock, { backgroundColor: theme.colors.canvas }]}>
      <BrandLogo variant="lockup" size={120} />
      <ThemedText variant="title">SplitSaathi is locked</ThemedText>
      <ThemedText variant="body" tone="muted" style={styles.copy}>
        Confirm it&apos;s you to continue.
      </ThemedText>
      {error ? (
        <ThemedText variant="bodySm" tone="owe" style={styles.copy}>
          {error}
        </ThemedText>
      ) : null}
      <Button label="Unlock" onPress={() => void unlock()} loading={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  lock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24
  },
  copy: {
    textAlign: "center",
    marginBottom: 8
  }
});
