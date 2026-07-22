import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../api/client";
import { readCachedBiometricPrefs, writeCachedBiometricPrefs } from "../auth/biometricPrefsCache";
import { BrandLogo } from "./BrandLogo";
import { Button } from "./Button";
import { ThemedText } from "./ThemedText";
import { useTheme } from "../theme";

type Props = {
  children: React.ReactNode;
  enabled: boolean;
};

type GatePhase = "checking" | "locked" | "unlocked";

/**
 * When biometricAuthEnabled is on, require device biometrics/PIN after cold start
 * and when returning from background past sessionTimeoutSeconds.
 *
 * Stays on a lock/checking surface until preference state is known — never flashes
 * the main app first, then locks a moment later.
 */
export function BiometricGate({ children, enabled }: Props) {
  const theme = useTheme();
  const preferencesQuery = useQuery({
    queryKey: ["preferences"],
    queryFn: () => apiClient.getPreferences(),
    enabled
  });

  const [phase, setPhase] = useState<GatePhase>(enabled ? "checking" : "unlocked");
  const [biometricOn, setBiometricOn] = useState(false);
  const [timeoutSeconds, setTimeoutSeconds] = useState(0);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const lastBackgroundAt = useRef<number | null>(null);
  const prompting = useRef(false);
  const unlockedRef = useRef(false);

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
        const pin = await LocalAuthentication.authenticateAsync({
          promptMessage: "Unlock SplitSaathi",
          fallbackLabel: "Use device passcode",
          cancelLabel: "Cancel",
          disableDeviceFallback: false
        });
        if (pin.success) {
          unlockedRef.current = true;
          setPhase("unlocked");
        } else {
          unlockedRef.current = false;
          setPhase("locked");
          setError("Authentication required to open SplitSaathi.");
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
        unlockedRef.current = true;
        setPhase("unlocked");
      } else {
        unlockedRef.current = false;
        setPhase("locked");
        setError("Could not verify your identity. Try again.");
      }
    } catch (err) {
      unlockedRef.current = false;
      setPhase("locked");
      setError(err instanceof Error ? err.message : "Biometric unlock failed.");
    } finally {
      setBusy(false);
      prompting.current = false;
    }
  }, []);

  // Local cache first so cold start locks immediately (no home flash).
  useEffect(() => {
    if (!enabled) {
      setPhase("unlocked");
      return;
    }
    let cancelled = false;
    void (async () => {
      const cached = await readCachedBiometricPrefs();
      if (cancelled) {
        return;
      }
      if (cached?.biometricAuthEnabled) {
        setBiometricOn(true);
        setTimeoutSeconds(cached.sessionTimeoutSeconds);
        unlockedRef.current = false;
        setPhase("locked");
        void unlock();
        return;
      }
      // No cache yet — stay on checking surface until server prefs resolve.
      setPhase("checking");
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, unlock]);

  // Reconcile with server preferences once they arrive.
  useEffect(() => {
    if (!enabled || preferencesQuery.isLoading || !preferencesQuery.data) {
      return;
    }
    const on = Boolean(preferencesQuery.data.biometricAuthEnabled);
    const timeout = preferencesQuery.data.sessionTimeoutSeconds ?? 0;
    setBiometricOn(on);
    setTimeoutSeconds(timeout);
    void writeCachedBiometricPrefs({
      biometricAuthEnabled: on,
      sessionTimeoutSeconds: timeout
    });

    if (!on) {
      unlockedRef.current = true;
      setPhase("unlocked");
      return;
    }

    // Biometrics required: if we already unlocked this session, keep unlocked.
    if (unlockedRef.current) {
      setPhase("unlocked");
      return;
    }
    setPhase("locked");
    void unlock();
  }, [enabled, preferencesQuery.isLoading, preferencesQuery.data, unlock]);

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
      if (timeoutSeconds === 0 || elapsedSec >= timeoutSeconds) {
        unlockedRef.current = false;
        setPhase("locked");
        void unlock();
      }
    });
    return () => sub.remove();
  }, [enabled, biometricOn, timeoutSeconds, unlock]);

  if (!enabled || phase === "unlocked") {
    return <>{children}</>;
  }

  return (
    <View style={[styles.lock, { backgroundColor: theme.colors.canvas }]}>
      <BrandLogo variant="lockup" size={120} />
      <ThemedText variant="title">
        {phase === "checking" ? "SplitSaathi" : "SplitSaathi is locked"}
      </ThemedText>
      <ThemedText variant="body" tone="muted" style={styles.copy}>
        {phase === "checking" ? "Checking security…" : "Confirm it's you to continue."}
      </ThemedText>
      {error ? (
        <ThemedText variant="bodySm" tone="owe" style={styles.copy}>
          {error}
        </ThemedText>
      ) : null}
      {phase === "locked" ? <Button label="Unlock" onPress={() => void unlock()} loading={busy} /> : null}
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
