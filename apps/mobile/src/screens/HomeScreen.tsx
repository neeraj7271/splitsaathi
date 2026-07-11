import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { CloudArrowUp, FileCsv, Receipt, Scales } from "phosphor-react-native";

import { apiClient } from "../api/client";
import { ActivityRow } from "../components/ActivityRow";
import { BalanceHeroCard } from "../components/BalanceHeroCard";
import { DataSurface } from "../components/DataSurface";
import { EmptyState } from "../components/EmptyState";
import { GroupSelector } from "../components/GroupSelector";
import { InlineNotice } from "../components/InlineNotice";
import { QuickActionGrid } from "../components/QuickActionGrid";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { StatusPill } from "../components/StatusPill";
import { ThemedText } from "../components/ThemedText";
import { useTheme } from "../theme";
import { AppNavigation } from "../types/navigation";
import { formatSignedMoney } from "../utils/money";

export function HomeScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const groupsQuery = useQuery({ queryKey: ["groups"], queryFn: () => apiClient.listGroups() });
  const groups = groupsQuery.data ?? [];
  const selectedGroupId = navigation.selectedGroupId ?? groups[0]?.id;
  const activityQuery = useQuery({
    queryKey: ["groupActivity", selectedGroupId],
    queryFn: () => apiClient.getGroupActivity(selectedGroupId as string),
    enabled: Boolean(selectedGroupId)
  });

  useEffect(() => {
    if (!navigation.selectedGroupId && groups[0]?.id) {
      navigation.setSelectedGroupId(groups[0].id);
    }
  }, [groups, navigation]);

  const netBalance = groups.reduce((total, group) => total + (group.netBalanceMinor ?? 0), 0);
  const pendingProofs = groups.reduce((total, group) => total + (group.pendingProofCount ?? 0), 0);

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <ThemedText variant="caption" tone="muted">
            SplitSaathi
          </ThemedText>
          <ThemedText variant="title">Current & Calm</ThemedText>
        </View>
        {pendingProofs ? <StatusPill state="proof_submitted" /> : null}
      </View>

      <BalanceHeroCard
        label="Your balance across groups"
        amountMinor={netBalance}
        currencyCode="INR"
        primaryAction={{ label: "Settle Up", onPress: () => navigation.go("settlement") }}
        secondaryAction={{ label: "Add Expense", onPress: () => navigation.go("expense") }}
      />

      <QuickActionGrid
        actions={[
          { label: "Expense", icon: Receipt, onPress: () => navigation.go("expense") },
          { label: "Settle", icon: Scales, onPress: () => navigation.go("settlement") },
          { label: "Sync", icon: CloudArrowUp, onPress: () => navigation.go("offline") },
          { label: "Import", icon: FileCsv, onPress: () => navigation.go("importExport") }
        ]}
      />

      {groupsQuery.error ? <InlineNotice title="Groups could not load" body={groupsQuery.error.message} tone="owe" /> : null}

      <View style={styles.section}>
        <SectionHeader title="Groups" />
        {groups.length ? (
          <>
            <GroupSelector groups={groups} selectedGroupId={selectedGroupId} onSelect={navigation.setSelectedGroupId} />
            <DataSurface>
              {groups.map((group) => (
                <Pressable
                  key={group.id}
                  onPress={() => {
                    navigation.setSelectedGroupId(group.id);
                    navigation.go("groupDetail");
                  }}
                  style={[styles.groupRow, { borderBottomColor: theme.colors.hairline, paddingVertical: theme.spacing.rowVertical }]}
                >
                  <View style={styles.groupMeta}>
                    <ThemedText variant="bodyMedium">{group.name}</ThemedText>
                    <ThemedText variant="bodySm" tone="muted">
                      {group.mode} - {group.participantCount ?? 0} members
                    </ThemedText>
                  </View>
                  <ThemedText variant="amount" tone={(group.netBalanceMinor ?? 0) >= 0 ? "receive" : "owe"} align="right">
                    {formatSignedMoney(group.netBalanceMinor, group.baseCurrencyCode)}
                  </ThemedText>
                </Pressable>
              ))}
            </DataSurface>
          </>
        ) : (
          <EmptyState title="Create your first group" body="Start a flat, trip, couple, or event ledger without asking for contacts first." action={{ label: "Create group", onPress: () => navigation.go("groups") }} />
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Recent activity" />
        {activityQuery.error ? <InlineNotice title="Activity could not load" body={activityQuery.error.message} tone="owe" /> : null}
        {activityQuery.data?.length ? (
          <DataSurface>{activityQuery.data.slice(0, 6).map((item) => <ActivityRow key={item.id} item={item} />)}</DataSurface>
        ) : (
          <EmptyState title="No ledger activity yet" body="Accepted expenses, proofs, edits, and settlements will appear here." />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  section: {
    gap: 12
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    gap: 12
  },
  groupMeta: {
    flex: 1,
    gap: 4
  }
});
