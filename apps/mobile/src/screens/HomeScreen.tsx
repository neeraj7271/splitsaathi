import React, { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { CloudArrowUp, FileCsv, Receipt, Repeat, Scales } from "phosphor-react-native";

import { apiClient } from "../api/client";
import { ActivityRow } from "../components/ActivityRow";
import { BalanceHeroCard } from "../components/BalanceHeroCard";
import { BrandLogo } from "../components/BrandLogo";
import { Button } from "../components/Button";
import { DataSurface } from "../components/DataSurface";
import { EmptyState } from "../components/EmptyState";
import { GroupSelector } from "../components/GroupSelector";
import { InlineNotice } from "../components/InlineNotice";
import { QuickActionGrid } from "../components/QuickActionGrid";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { StatusPill } from "../components/StatusPill";
import { ThemedText } from "../components/ThemedText";
import { UserAvatar } from "../components/UserAvatar";
import { useTheme } from "../theme";
import { AppNavigation } from "../types/navigation";
import { formatSignedMoney } from "../utils/money";
import { buildGroupDisplayLookups, enrichActivityRows } from "../utils/displayNames";

const HOME_ACTIVITY_LIMIT = 20;

export function HomeScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const groupsQuery = useQuery({ queryKey: ["groups"], queryFn: () => apiClient.listGroups() });
  const profileQuery = useQuery({ queryKey: ["me"], queryFn: () => apiClient.getMe() });
  const groups = groupsQuery.data ?? [];
  const selectedGroupId = navigation.selectedGroupId ?? groups[0]?.id;
  const activityQuery = useQuery({
    queryKey: ["groupActivity", selectedGroupId, { limit: HOME_ACTIVITY_LIMIT }],
    queryFn: () => apiClient.getGroupActivity(selectedGroupId as string, { limit: HOME_ACTIVITY_LIMIT }),
    enabled: Boolean(selectedGroupId)
  });
  const groupQuery = useQuery({
    queryKey: ["group", selectedGroupId],
    queryFn: () => apiClient.getGroup(selectedGroupId as string),
    enabled: Boolean(selectedGroupId)
  });
  const activityItems = activityQuery.data?.items ?? [];
  const enrichedActivity = useMemo(() => {
    if (!activityItems.length) {
      return [];
    }
    if (!groupQuery.data) {
      return activityItems;
    }
    return enrichActivityRows(activityItems, buildGroupDisplayLookups(groupQuery.data), groupQuery.data.name);
  }, [activityItems, groupQuery.data]);

  useEffect(() => {
    if (!navigation.selectedGroupId && groups[0]?.id) {
      navigation.setSelectedGroupId(groups[0].id);
    }
  }, [groups, navigation]);

  const netBalance = groups.reduce((total, group) => total + (group.netBalanceMinor ?? 0), 0);
  const pendingProofs = groups.reduce((total, group) => total + (group.pendingProofCount ?? 0), 0);
  const refreshing = groupsQuery.isRefetching || profileQuery.isRefetching || activityQuery.isRefetching || groupQuery.isRefetching;

  async function refreshScreen() {
    await Promise.all([
      groupsQuery.refetch(),
      profileQuery.refetch(),
      selectedGroupId ? activityQuery.refetch() : Promise.resolve(),
      selectedGroupId ? groupQuery.refetch() : Promise.resolve()
    ]);
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refreshScreen()}>
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <View style={styles.headerMarkClip}>
            <BrandLogo variant="mark" size={40} />
          </View>
          <View style={styles.headerCopy}>
            <View style={styles.wordmarkChip}>
              <BrandLogo variant="wordmark" size={18} />
            </View>
            <ThemedText variant="title">{profileQuery.data?.displayName ?? "Current & Calm"}</ThemedText>
          </View>
        </View>
        <View style={styles.headerRight}>
          {pendingProofs ? <StatusPill state="proof_submitted" /> : null}
          <Pressable onPress={() => navigation.go("profile")} style={styles.profileButton}>
            <UserAvatar displayName={profileQuery.data?.displayName ?? "?"} avatarUrl={profileQuery.data?.avatarUrl} size={36} />
          </Pressable>
        </View>
      </View>

      <BalanceHeroCard
        label="Your balance across groups"
        amountMinor={netBalance}
        currencyCode="INR"
        primaryAction={{ label: "Settle Up", onPress: () => navigation.go("settlement") }}
        secondaryAction={{ label: "Balances", onPress: () => navigation.go("balances") }}
      />

      <QuickActionGrid
        actions={[
          { label: "Expense", icon: Receipt, onPress: () => navigation.go("expense") },
          { label: "Settle", icon: Scales, onPress: () => navigation.go("settlement") },
          { label: "Recurring", icon: Repeat, onPress: () => navigation.go("recurring") },
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
                      {group.category ? `${group.category} · ` : ""}{group.participantCount ?? 0} members
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
        <SectionHeader
          title="Recent activity"
          action={
            selectedGroupId ? (
              <Button label="See all in group" variant="ghost" onPress={() => navigation.go("groupDetail")} />
            ) : undefined
          }
        />
        {activityQuery.error ? <InlineNotice title="Activity could not load" body={activityQuery.error.message} tone="owe" /> : null}
        {enrichedActivity.length ? (
          <>
            <DataSurface>
              {enrichedActivity.map((item) => (
                <ActivityRow
                  key={item.id}
                  item={item}
                  groupName={groupQuery.data?.name}
                  groupImageUrl={groupQuery.data?.imageUrl}
                />
              ))}
            </DataSurface>
            {activityQuery.data?.nextCursor != null || enrichedActivity.length >= HOME_ACTIVITY_LIMIT ? (
              <Button label="See all in group" variant="secondary" onPress={() => navigation.go("groupDetail")} />
            ) : null}
          </>
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
    justifyContent: "space-between",
    gap: 12
  },
  headerBrand: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  headerMarkClip: {
    borderRadius: 10,
    overflow: "hidden"
  },
  headerCopy: {
    flex: 1,
    gap: 4,
    alignItems: "flex-start"
  },
  wordmarkChip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
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
