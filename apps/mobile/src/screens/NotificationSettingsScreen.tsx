import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../api/client";
import { useAppDialog } from "../components/AppDialog";
import { DataSurface } from "../components/DataSurface";
import { InlineNotice } from "../components/InlineNotice";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionHeader } from "../components/SectionHeader";
import { SettingsToggleRow } from "../components/SettingsToggleRow";
import { ThemedText } from "../components/ThemedText";
import { registerPushIfPossible, unregisterPushIfPossible } from "../notifications/registerPush";
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

async function applyPushSideEffects(
  preferences: UserPreferences,
  showDialog: ReturnType<typeof useAppDialog>["showDialog"]
): Promise<string | undefined> {
  if (!preferences.pushNotificationsEnabled) {
    await unregisterPushIfPossible().catch(() => undefined);
    await apiClient.recordConsent("notification_delivery", false, "settings").catch(() => undefined);
    return "Push notifications are turned off for this account on this device.";
  }

  await apiClient.recordConsent("notification_delivery", true, "settings").catch(() => undefined);
  const result = await registerPushIfPossible({ forcePrompt: true });
  if (result.status === "registered") {
    return "This device is registered for push notifications.";
  }
  showDialog({
    title: "Push not registered",
    message: `${result.reason}\n\nEnable notifications for SplitSaathi in Android Settings if you want alerts on this device.`,
    tone: "warning",
    primaryAction: { label: "OK" }
  });
  return `Push not registered: ${result.reason}`;
}

export function NotificationSettingsScreen({ navigation }: { navigation: AppNavigation }) {
  const { showDialog } = useAppDialog();
  const queryClient = useQueryClient();
  const preferencesQuery = useQuery({ queryKey: ["preferences"], queryFn: () => apiClient.getPreferences() });
  const [draft, setDraft] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [pushStatus, setPushStatus] = useState<string>();

  useEffect(() => {
    if (preferencesQuery.data) {
      setDraft(preferencesQuery.data);
      if (!preferencesQuery.data.pushNotificationsEnabled) {
        setPushStatus("Push notifications are turned off for this account.");
      }
    }
  }, [preferencesQuery.data]);

  const savePreferences = useMutation({
    mutationFn: (patch: Partial<UserPreferences>) => apiClient.updatePreferences(patch),
    onSuccess: async (preferences, patch) => {
      queryClient.setQueryData(["preferences"], preferences);
      setDraft(preferences);
      if (patch.pushNotificationsEnabled !== undefined) {
        const status = await applyPushSideEffects(preferences, showDialog);
        setPushStatus(status);
      }
    }
  });

  function updatePreference(key: keyof UserPreferences, value: boolean) {
    const previous = draft[key];
    const patch = { [key]: value } as Partial<UserPreferences>;
    setDraft((current) => ({ ...current, [key]: value }));
    savePreferences.mutate(patch, {
      onError: () => {
        setDraft((current) => ({ ...current, [key]: previous }));
      }
    });
  }

  return (
    <Screen>
      <ScreenHeader navigation={navigation} fallbackRoute="profile" title="Notifications" />

      {preferencesQuery.isLoading ? (
        <ThemedText variant="bodySm" tone="muted">
          Loading saved preferences…
        </ThemedText>
      ) : null}
      {preferencesQuery.error ? <InlineNotice title="Settings could not load" body={preferencesQuery.error.message} tone="owe" /> : null}
      {savePreferences.error ? <InlineNotice title="Save failed" body={savePreferences.error.message} tone="owe" /> : null}
      {savePreferences.isPending ? (
        <ThemedText variant="bodySm" tone="muted">
          Saving…
        </ThemedText>
      ) : null}

      <DataSurface>
        <View style={styles.block}>
          <SettingsToggleRow
            label="Push notifications"
            subtitle="Master switch for all device alerts"
            value={draft.pushNotificationsEnabled}
            onValueChange={(value) => updatePreference("pushNotificationsEnabled", value)}
            disabled={preferencesQuery.isLoading || savePreferences.isPending}
          />
          {pushStatus ? (
            <ThemedText variant="caption" tone="muted" style={styles.pushStatus}>
              {pushStatus}
            </ThemedText>
          ) : null}
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
                  onValueChange={(value) => updatePreference(item.key, value)}
                  disabled={preferencesQuery.isLoading || savePreferences.isPending}
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
              onValueChange={(value) => updatePreference("emailMonthlySummary", value)}
              disabled={preferencesQuery.isLoading || savePreferences.isPending}
            />
          </View>
        </DataSurface>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8
  },
  block: {
    gap: 8,
    padding: 8
  },
  pushStatus: {
    paddingHorizontal: 4
  }
});
