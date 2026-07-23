import React, { useEffect, useState } from "react";
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

type PreferenceToggleKey =
  | "emailGroupAdded"
  | "emailFriendAdded"
  | "emailExpenseAdded"
  | "emailExpenseEdited"
  | "emailExpenseDue"
  | "emailPaymentReceived"
  | "emailMonthlySummary";

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
  emailNewsUpdates: false
};

const PUSH_SECTIONS: Array<{
  title: string;
  items: Array<{ key: PreferenceToggleKey; label: string; subtitle: string }>;
}> = [
  {
    title: "Groups and contacts",
    items: [
      {
        key: "emailGroupAdded",
        label: "Group updates",
        subtitle: "Added to a group, invite accepted, role or membership changes"
      },
      {
        key: "emailFriendAdded",
        label: "Contact joined SplitSaathi",
        subtitle: "Someone from your contacts signs up with their phone number"
      }
    ]
  },
  {
    title: "Expenses and payments",
    items: [
      { key: "emailExpenseAdded", label: "Expense added", subtitle: "Someone adds an expense in your group" },
      { key: "emailExpenseEdited", label: "Expense edited or deleted", subtitle: "Expense revised or voided" },
      { key: "emailExpenseDue", label: "Reminders", subtitle: "Settlement day, recurring expense, and proof reminders" },
      { key: "emailPaymentReceived", label: "Payments", subtitle: "Settlement confirmation requests and confirmations" }
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
    onSuccess: async (preferences) => {
      queryClient.setQueryData(["preferences"], preferences);
      setDraft(preferences);
      setSavedSnapshot(preferences);
      if (preferences.pushNotificationsEnabled) {
        await import("../notifications/registerPush").then(({ registerPushIfPossible }) =>
          registerPushIfPossible().catch(() => undefined)
        );
      }
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
            subtitle="Master switch for all device alerts"
            value={draft.pushNotificationsEnabled}
            onValueChange={(value) => updateDraft("pushNotificationsEnabled", value)}
            disabled={preferencesQuery.isLoading}
          />
        </View>
      </DataSurface>

      {PUSH_SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <SectionHeader title={section.title} />
          <DataSurface>
            <View style={styles.block}>
              {section.items.map((item) => (
                <SettingsToggleRow
                  key={item.key}
                  label={item.label}
                  subtitle={item.subtitle}
                  value={draft[item.key]}
                  onValueChange={(value) => updateDraft(item.key, value)}
                  disabled={preferencesQuery.isLoading || !draft.pushNotificationsEnabled}
                />
              ))}
            </View>
          </DataSurface>
        </View>
      ))}

      <View style={styles.section}>
        <SectionHeader title="Email" />
        <DataSurface>
          <View style={styles.block}>
            <SettingsToggleRow
              label="Monthly summary email"
              subtitle="Email a balance summary for each active group (uses your Google/login email)"
              value={draft.emailMonthlySummary}
              onValueChange={(value) => updateDraft("emailMonthlySummary", value)}
              disabled={preferencesQuery.isLoading}
            />
          </View>
        </DataSurface>
      </View>

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
