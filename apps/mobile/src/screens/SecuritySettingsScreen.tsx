import React, { useEffect, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../api/client";
import { writeCachedBiometricPrefs } from "../auth/biometricPrefsCache";
import { Button } from "../components/Button";
import { DataSurface } from "../components/DataSurface";
import { InlineNotice } from "../components/InlineNotice";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { SettingsLinkRow } from "../components/SettingsLinkRow";
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

  const deleteAccount = useMutation({
    mutationFn: () => apiClient.deleteAccount(),
    onSuccess: () => {
      navigation.signOut();
    }
  });

  function confirmDeleteAccount() {
    Alert.alert(
      "Delete account?",
      "This signs you out and schedules your SplitSaathi account for deletion. Group expense history may remain visible to other members.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () => deleteAccount.mutate()
        }
      ]
    );
  }

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
      <ScreenHeader navigation={navigation} fallbackRoute="profile" title="Security" />

      {preferencesQuery.error ? <InlineNotice title="Settings could not load" body={preferencesQuery.error.message} tone="owe" /> : null}
      {savePreferences.error ? <InlineNotice title="Save failed" body={savePreferences.error.message} tone="owe" /> : null}
      {deleteAccount.error ? <InlineNotice title="Account deletion failed" body={deleteAccount.error.message} tone="owe" /> : null}

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

      <DataSurface>
        <View style={styles.block}>
          <ThemedText variant="bodyMedium" style={{ fontWeight: "600" }}>Privacy & legal</ThemedText>
          <SettingsLinkRow
            label="Privacy policy"
            subtitle="How SplitSaathi uses your data"
            onPress={() => void Linking.openURL("https://thesplitsaathi.com/privacy")}
          />
          <SettingsLinkRow
            label="Terms of service"
            subtitle="Rules for using SplitSaathi"
            onPress={() => void Linking.openURL("https://thesplitsaathi.com/terms")}
          />
        </View>
      </DataSurface>

      <DataSurface>
        <View style={styles.block}>
          <ThemedText variant="bodyMedium" style={{ fontWeight: "600" }}>Account</ThemedText>
          <ThemedText variant="bodySm" tone="muted">
            Deleting your account signs you out on all devices and removes your profile details from SplitSaathi.
          </ThemedText>
          <Button
            label="Delete account"
            variant="destructive"
            onPress={confirmDeleteAccount}
            loading={deleteAccount.isPending}
            disabled={deleteAccount.isPending}
          />
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
