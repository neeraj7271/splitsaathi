import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "phosphor-react-native";

import { apiClient } from "../api/client";
import { writeCachedBiometricPrefs } from "../auth/biometricPrefsCache";
import { DataSurface } from "../components/DataSurface";
import { InlineNotice } from "../components/InlineNotice";
import { Screen } from "../components/Screen";
import { SettingsToggleRow } from "../components/SettingsToggleRow";
import { ThemedText } from "../components/ThemedText";
import { useTheme } from "../theme";
import { AppNavigation } from "../types/navigation";

const TIMEOUT_OPTIONS = [
  { label: "Immediately", value: 0 },
  { label: "5 seconds", value: 5 },
  { label: "30 seconds", value: 30 },
  { label: "1 minute", value: 60 },
  { label: "5 minutes", value: 300 },
  { label: "10 minutes", value: 600 }
] as const;

export function SecuritySettingsScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const preferencesQuery = useQuery({ queryKey: ["preferences"], queryFn: () => apiClient.getPreferences() });
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [timeoutSeconds, setTimeoutSeconds] = useState(5);

  useEffect(() => {
    if (preferencesQuery.data) {
      setBiometricEnabled(preferencesQuery.data.biometricAuthEnabled);
      setTimeoutSeconds(preferencesQuery.data.sessionTimeoutSeconds);
    }
  }, [preferencesQuery.data]);

  const savePreferences = useMutation({
    mutationFn: (input: { biometricAuthEnabled?: boolean; sessionTimeoutSeconds?: number }) => apiClient.updatePreferences(input),
    onSuccess: (preferences) => {
      queryClient.setQueryData(["preferences"], preferences);
      setBiometricEnabled(preferences.biometricAuthEnabled);
      setTimeoutSeconds(preferences.sessionTimeoutSeconds);
      void writeCachedBiometricPrefs({
        biometricAuthEnabled: preferences.biometricAuthEnabled,
        sessionTimeoutSeconds: preferences.sessionTimeoutSeconds
      });
    }
  });

  const timeoutLabel = TIMEOUT_OPTIONS.find((option) => option.value === timeoutSeconds)?.label ?? `${timeoutSeconds} seconds`;

  function cycleTimeout() {
    const currentIndex = TIMEOUT_OPTIONS.findIndex((option) => option.value === timeoutSeconds);
    const next = TIMEOUT_OPTIONS[(currentIndex + 1) % TIMEOUT_OPTIONS.length];
    const previous = timeoutSeconds;
    setTimeoutSeconds(next.value);
    savePreferences.mutate(
      { sessionTimeoutSeconds: next.value },
      {
        onError: () => setTimeoutSeconds(previous)
      }
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.go("profile")} style={styles.backButton}>
          <ArrowLeft size={22} color={theme.colors.ink} />
        </Pressable>
        <ThemedText variant="title">Security</ThemedText>
      </View>

      {preferencesQuery.error ? <InlineNotice title="Settings could not load" body={preferencesQuery.error.message} tone="owe" /> : null}
      {savePreferences.error ? <InlineNotice title="Save failed" body={savePreferences.error.message} tone="owe" /> : null}

      <DataSurface>
        <View style={styles.block}>
          <SettingsToggleRow
            label="Authenticate with biometrics"
            subtitle="Require device passcode or biometrics to open SplitSaathi"
            value={biometricEnabled}
            disabled={preferencesQuery.isLoading || savePreferences.isPending}
            onValueChange={(value) => {
              const previous = biometricEnabled;
              setBiometricEnabled(value);
              savePreferences.mutate(
                { biometricAuthEnabled: value },
                {
                  onError: () => setBiometricEnabled(previous)
                }
              );
            }}
          />
          <Pressable
            onPress={cycleTimeout}
            disabled={preferencesQuery.isLoading || savePreferences.isPending}
            style={[styles.timeoutRow, { backgroundColor: theme.colors.surface, opacity: preferencesQuery.isLoading ? 0.6 : 1 }]}
          >
            <View style={styles.copy}>
              <ThemedText variant="body">Timeout</ThemedText>
              <ThemedText variant="bodySm" tone="muted">
                Authentication will not be required if the app is reopened before the timeout expires.
              </ThemedText>
            </View>
            <ThemedText variant="bodySm" tone="confirmed">
              {timeoutLabel}
            </ThemedText>
          </Pressable>
        </View>
      </DataSurface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  backButton: {
    padding: 4
  },
  block: {
    gap: 8,
    padding: 8
  },
  timeoutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14
  },
  copy: {
    flex: 1,
    gap: 2,
    paddingRight: 8
  }
});
