import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, UsersThree } from "phosphor-react-native";

import { apiClient } from "../api/client";
import { Button } from "../components/Button";
import { DataSurface } from "../components/DataSurface";
import { InlineNotice } from "../components/InlineNotice";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { ThemedText } from "../components/ThemedText";
import { useTheme } from "../theme";
import { AppNavigation } from "../types/navigation";
import { hasContactsConsent, syncDeviceContacts } from "../utils/contactDiscovery";

export function ContactsSettingsScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contactsQuery = useQuery({
    queryKey: ["contacts"],
    queryFn: () => apiClient.listContacts(),
    enabled
  });

  useEffect(() => {
    hasContactsConsent()
      .then(setEnabled)
      .catch(() => setEnabled(false));
  }, []);

  const saveConsent = useMutation({
    mutationFn: async (granted: boolean) => {
      setError(null);
      await apiClient.recordConsent("contacts_discovery", granted, "settings");
      if (granted) {
        await syncDeviceContacts();
      }
    },
    onSuccess: async () => {
      const granted = await hasContactsConsent();
      setEnabled(granted);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message);
    }
  });

  const resync = useMutation({
    mutationFn: () => syncDeviceContacts(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contacts"] }),
    onError: (mutationError: Error) => setError(mutationError.message)
  });

  const matchedCount = contactsQuery.data?.filter((contact) => contact.onSplitSaathi).length ?? 0;

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.back() || navigation.go("settings")} style={styles.backButton}>
          <ArrowLeft size={22} color={theme.colors.ink} />
        </Pressable>
        <ThemedText variant="title">Contacts</ThemedText>
      </View>

      <DataSurface>
        <Pressable
          onPress={() => saveConsent.mutate(!enabled)}
          disabled={saveConsent.isPending}
          style={[styles.consentRow, { borderColor: enabled ? theme.colors.confirmed : theme.colors.hairline, backgroundColor: theme.colors.surfaceRaised }]}
        >
          <View style={styles.consentText}>
            <ThemedText variant="bodyMedium">Find friends on SplitSaathi</ThemedText>
            <ThemedText variant="bodySm" tone="muted">
              We upload phone hashes only, never your full contact book as plain text.
            </ThemedText>
          </View>
          <View style={[styles.check, { backgroundColor: enabled ? theme.colors.confirmed : "transparent", borderColor: enabled ? theme.colors.confirmed : theme.colors.inkFaint }]}>
            {enabled ? <Check size={14} color={theme.colors.surface} weight="bold" /> : null}
          </View>
        </Pressable>
      </DataSurface>

      {enabled ? (
        <View style={styles.section}>
          <SectionHeader title="Imported contacts" />
          <ThemedText variant="bodySm" tone="muted">
            {contactsQuery.data?.length ?? 0} contacts imported. {matchedCount} already on SplitSaathi.
          </ThemedText>
          <Button label="Sync contacts again" variant="secondary" onPress={() => resync.mutate()} loading={resync.isPending} />
        </View>
      ) : (
        <InlineNotice title="Contacts are off" body="Turn this on to pick people from your phone when creating groups." tone="info" />
      )}

      {error ? <InlineNotice title="Contacts action failed" body={error} tone="owe" /> : null}
      {saveConsent.error ? <InlineNotice title="Consent could not be saved" body={saveConsent.error.message} tone="owe" /> : null}

      <View style={styles.noteRow}>
        <UsersThree size={18} color={theme.colors.inkMuted} weight="duotone" />
        <ThemedText variant="bodySm" tone="muted">
          Use "Add from contacts" on the Groups screen after syncing here.
        </ThemedText>
      </View>
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
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    padding: 14,
    borderRadius: 12
  },
  consentText: {
    flex: 1,
    gap: 4
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  section: {
    gap: 10
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  }
});
