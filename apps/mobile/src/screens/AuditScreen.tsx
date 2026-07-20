import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../api/client";
import { buildGroupDisplayLookups, enrichActivityRows, enrichAuditEntries, resolveActorDisplayName } from "../utils/displayNames";
import { ActivityRow } from "../components/ActivityRow";
import { AuditRail } from "../components/AuditRail";
import { Button } from "../components/Button";
import { DataSurface } from "../components/DataSurface";
import { EmptyState } from "../components/EmptyState";
import { GroupSelector } from "../components/GroupSelector";
import { InlineNotice } from "../components/InlineNotice";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { ThemedText } from "../components/ThemedText";
import { AppNavigation } from "../types/navigation";

export function AuditScreen({ navigation }: { navigation: AppNavigation }) {
  const groupsQuery = useQuery({ queryKey: ["groups"], queryFn: () => apiClient.listGroups() });
  const groups = groupsQuery.data ?? [];
  const selectedGroupId = navigation.selectedGroupId ?? groups[0]?.id;
  const activityQuery = useQuery({
    queryKey: ["groupActivity", selectedGroupId],
    queryFn: () => apiClient.getGroupActivity(selectedGroupId as string),
    enabled: Boolean(selectedGroupId)
  });
  const groupQuery = useQuery({
    queryKey: ["group", selectedGroupId],
    queryFn: () => apiClient.getGroup(selectedGroupId as string),
    enabled: Boolean(selectedGroupId)
  });
  const historyQuery = useQuery({
    queryKey: ["expenseHistory", navigation.selectedExpenseId],
    queryFn: () => apiClient.getExpenseHistory(navigation.selectedExpenseId as string),
    enabled: Boolean(navigation.selectedExpenseId)
  });

  const expenseHistoryEntries = useMemo(() => {
    if (!historyQuery.data?.length || !groupQuery.data) {
      return historyQuery.data ?? [];
    }
    return enrichAuditEntries(historyQuery.data, buildGroupDisplayLookups(groupQuery.data));
  }, [groupQuery.data, historyQuery.data]);

  useEffect(() => {
    if (!navigation.selectedGroupId && groups[0]?.id) {
      navigation.setSelectedGroupId(groups[0].id);
    }
  }, [groups, navigation]);

  const enrichedActivity = useMemo(() => {
    if (!activityQuery.data?.length) {
      return [];
    }
    if (!groupQuery.data) {
      return activityQuery.data;
    }
    return enrichActivityRows(activityQuery.data, buildGroupDisplayLookups(groupQuery.data), groupQuery.data.name);
  }, [activityQuery.data, groupQuery.data]);

  const activityAsAudit = useMemo(() => {
    const lookups = groupQuery.data ? buildGroupDisplayLookups(groupQuery.data) : undefined;
    return enrichedActivity.map((activity) => ({
      id: activity.id,
      actorName: activity.actorId && lookups ? resolveActorDisplayName(activity.actorId, lookups) : undefined,
      summary: activity.title,
      reason: activity.body,
      createdAt: activity.occurredAt
    }));
  }, [enrichedActivity, groupQuery.data]);

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <ThemedText variant="caption" tone="muted">
            Immutable history
          </ThemedText>
          <ThemedText variant="title">Activity and audit</ThemedText>
        </View>
        <Button label="Group" variant="secondary" onPress={() => navigation.go("groupDetail")} />
      </View>

      {groups.length ? <GroupSelector groups={groups} selectedGroupId={selectedGroupId} onSelect={navigation.setSelectedGroupId} /> : null}
      {activityQuery.error ? <InlineNotice title="Activity could not load" body={activityQuery.error.message} tone="owe" /> : null}

      <View style={styles.section}>
        <SectionHeader title="Expense version history" />
        {navigation.selectedExpenseId ? (
          expenseHistoryEntries.length ? (
            <DataSurface>
              <View style={styles.railWrap}>
                <AuditRail entries={expenseHistoryEntries} />
              </View>
            </DataSurface>
          ) : (
            <EmptyState title="No version entries" body="The selected expense history endpoint has no entries yet." />
          )
        ) : (
          <EmptyState title="No expense selected" body="Open an expense from the group Expenses tab to see its versions." />
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Group event rail" />
        {activityAsAudit.length ? (
          <DataSurface>
            <View style={styles.railWrap}>
              <AuditRail entries={activityAsAudit} />
            </View>
          </DataSurface>
        ) : enrichedActivity.length ? (
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
        ) : (
          <EmptyState title="No group events" body="Expense creates, edits, voids, proof uploads, and settlements will appear here." />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  section: {
    gap: 12
  },
  railWrap: {
    padding: 14
  }
});
