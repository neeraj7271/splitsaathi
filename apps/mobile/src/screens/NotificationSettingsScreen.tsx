import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "phosphor-react-native";

import { apiClient } from "../api/client";
import { Button } from "../components/Button";
import { DataSurface } from "../components/DataSurface";
import { InlineNotice } from "../components/InlineNotice";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { SettingsToggleRow } from "../components/SettingsToggleRow";
import { ThemedText } from "../components/ThemedText";
import { useTheme } from "../theme";
import { AppNavigation } from "../types/navigation";
import type { UserPreferences } from "../types/domain";

type EmailPreferenceKey =
  | "emailGroupAdded"
  | "emailFriendAdded"
  | "emailExpenseAdded"
  | "emailExpenseEdited"
  | "emailExpenseComment"
  | "emailExpenseDue"
  | "emailPaymentReceived"
  | "emailMonthlySummary"
  | "emailNewsUpdates";

const DEFAULT_PREFERENCES: UserPreferences = {
  biometricAuthEnabled: false,
  sessionTimeoutSeconds: 5,
  appearance: "system",
  pushNotificationsEnabled: true,
  emailGroupAdded: true,
  emailFriendAdded: true,
  emailExpenseAdded: true,
  emailExpenseEdited: true,
  emailExpenseComment: false,
  emailExpenseDue: true,
  emailPaymentReceived: true,
  emailMonthlySummary: true,
  emailNewsUpdates: true
};

const EMAIL_SECTIONS: Array<{ title: string; items: Array<{ key: EmailPreferenceKey; label: string }> }> = [
  {
    title: "Groups and friends",
    items: [
      { key: "emailGroupAdded", label: "When someone adds me to a group" },
      { key: "emailFriendAdded", label: "When someone adds me as a friend" }
    ]
  },
  {
    title: "Expenses",
    items: [
      { key: "emailExpenseAdded", label: "When an expense is added" },
      { key: "emailExpenseEdited", label: "When an expense is edited/deleted" },
      { key: "emailExpenseComment", label: "When someone comments on an expense" },
      { key: "emailExpenseDue", label: "When an expense is due" },
      { key: "emailPaymentReceived", label: "When someone pays me" }
    ]
  },
  {
    title: "News and updates",
    items: [
      { key: "emailMonthlySummary", label: "Monthly summary of my activity" },
      { key: "emailNewsUpdates", label: "Major SplitSaathi news and updates" }
    ]
  }
];

export function NotificationSettingsScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const preferencesQuery = useQuery({ queryKey: ["preferences"], queryFn: () => apiClient.getPreferences() });
  const [draft, setDraft] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [savedSnapshot, setSavedSnapshot] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    if (preferencesQuery.data) {
      setDraft(preferencesQuery.data);
      setSavedSnapshot(preferencesQuery.data);
    }
  }, [preferencesQuery.data]);

  const savePreferences = useMutation({
    mutationFn: () => apiClient.updatePreferences(draft),
    onSuccess: (preferences) => {
      queryClient.setQueryData(["preferences"], preferences);
      setDraft(preferences);
      setSavedSnapshot(preferences);
    }
  });

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(savedSnapshot);

  function updateDraft(key: keyof UserPreferences, value: boolean) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.go("profile")} style={styles.backButton}>
          <ArrowLeft size={22} color={theme.colors.ink} />
        </Pressable>
        <ThemedText variant="title">Notifications</ThemedText>
      </View>

      {preferencesQuery.isLoading ? (
        <ThemedText variant="bodySm" tone="muted">
          Loading saved preferences…
        </ThemedText>
      ) : null}
      {preferencesQuery.error ? <InlineNotice title="Settings could not load" body={preferencesQuery.error.message} tone="owe" /> : null}

      <DataSurface>
        <View style={styles.block}>
          <SettingsToggleRow
            label="Push notifications"
            subtitle="Master switch for device alerts (expenses, payments, groups)"
            value={draft.pushNotificationsEnabled}
            onValueChange={(value) => updateDraft("pushNotificationsEnabled", value)}
            disabled={preferencesQuery.isLoading}
          />
        </View>
      </DataSurface>

      {EMAIL_SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <SectionHeader title={section.title} />
          <DataSurface>
            <View style={styles.block}>
              {section.items.map((item) => (
                <SettingsToggleRow
                  key={item.key}
                  label={item.label}
                  subtitle="Controls push alerts for this event"
                  value={draft[item.key]}
                  onValueChange={(value) => updateDraft(item.key, value)}
                  disabled={preferencesQuery.isLoading}
                />
              ))}
            </View>
          </DataSurface>
        </View>
      ))}

      <Button
        label="Save changes"
        onPress={() => savePreferences.mutate()}
        loading={savePreferences.isPending}
        disabled={!hasChanges || preferencesQuery.isLoading}
      />
      {savePreferences.error ? <InlineNotice title="Save failed" body={savePreferences.error.message} tone="owe" /> : null}
      {savePreferences.isSuccess && !hasChanges ? (
        <InlineNotice title="Saved" body="Your notification preferences were updated." tone="confirmed" />
      ) : null}
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
  section: {
    gap: 8
  },
  block: {
    gap: 8,
    padding: 8
  }
});
