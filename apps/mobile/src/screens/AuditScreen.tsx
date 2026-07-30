import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { CaretDown } from "phosphor-react-native";

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
import { ScreenBackButton } from "../components/ScreenBackButton";
import { SectionHeader } from "../components/SectionHeader";
import { ThemedText } from "../components/ThemedText";
import { colorWithAlpha, useTheme } from "../theme";
import { AppNavigation } from "../types/navigation";

export function AuditScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const LIMIT = 5;

  const groupsQuery = useQuery({ queryKey: ["groups"], queryFn: () => apiClient.listGroups() });
  const groups = groupsQuery.data ?? [];
  const selectedGroupId = navigation.selectedGroupId ?? groups[0]?.id;
  const activityQuery = useQuery({
    queryKey: ["groupActivity", selectedGroupId, { limit: 50, feed: "all" }],
    queryFn: () => apiClient.getGroupActivity(selectedGroupId as string, { limit: 50, feed: "all" }),
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

  const visibleHistory = showAllHistory ? expenseHistoryEntries : expenseHistoryEntries.slice(0, LIMIT);
  const hasMoreHistory = expenseHistoryEntries.length > LIMIT;

  const visibleEvents = showAllEvents ? activityAsAudit : activityAsAudit.slice(0, LIMIT);
  const hasMoreEvents = activityAsAudit.length > LIMIT;

  const visibleActivity = showAllEvents ? enrichedActivity : enrichedActivity.slice(0, LIMIT);
  const hasMoreActivity = enrichedActivity.length > LIMIT;

  return (
    <Screen>
      <ScreenBackButton navigation={navigation} label="Back" />
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
            <>
              <DataSurface>
                <View style={styles.railWrap}>
                  <AuditRail entries={visibleHistory} />
                </View>
              </DataSurface>
              {hasMoreHistory ? (
                <Pressable
                  onPress={() => setShowAllHistory((prev) => !prev)}
                  style={[
                    styles.seeAllButton,
                    {
                      borderColor: theme.colors.hairline,
                      backgroundColor: colorWithAlpha(theme.colors.info, theme.mode === "dark" ? 0.16 : 0.08)
                    }
                  ]}
                >
                  <ThemedText variant="bodySm" style={{ color: theme.colors.info, fontWeight: "600" }}>
                    {showAllHistory ? "Show less" : `See all (${expenseHistoryEntries.length})`}
                  </ThemedText>
                  <CaretDown size={14} color={theme.colors.info} style={{ transform: [{ rotate: showAllHistory ? "180deg" : "0deg" }] }} />
                </Pressable>
              ) : null}
            </>
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
          <>
            <DataSurface>
              <View style={styles.railWrap}>
                <AuditRail entries={visibleEvents} />
              </View>
            </DataSurface>
            {hasMoreEvents ? (
              <Pressable
                onPress={() => setShowAllEvents((prev) => !prev)}
                style={[
                  styles.seeAllButton,
                  {
                    borderColor: theme.colors.hairline,
                    backgroundColor: colorWithAlpha(theme.colors.info, theme.mode === "dark" ? 0.16 : 0.08)
                  }
                ]}
              >
                <ThemedText variant="bodySm" style={{ color: theme.colors.info, fontWeight: "600" }}>
                  {showAllEvents ? "Show less" : `See all (${activityAsAudit.length})`}
                </ThemedText>
                <CaretDown size={14} color={theme.colors.info} style={{ transform: [{ rotate: showAllEvents ? "180deg" : "0deg" }] }} />
              </Pressable>
            ) : null}
          </>
        ) : enrichedActivity.length ? (
          <>
            <DataSurface>
              {visibleActivity.map((item) => (
                <ActivityRow
                  key={item.id}
                  item={item}
                  groupName={groupQuery.data?.name}
                  groupImageUrl={groupQuery.data?.imageUrl}
                />
              ))}
            </DataSurface>
            {hasMoreActivity ? (
              <Pressable
                onPress={() => setShowAllEvents((prev) => !prev)}
                style={[
                  styles.seeAllButton,
                  {
                    borderColor: theme.colors.hairline,
                    backgroundColor: colorWithAlpha(theme.colors.info, theme.mode === "dark" ? 0.16 : 0.08)
                  }
                ]}
              >
                <ThemedText variant="bodySm" style={{ color: theme.colors.info, fontWeight: "600" }}>
                  {showAllEvents ? "Show less" : `See all (${enrichedActivity.length})`}
                </ThemedText>
                <CaretDown size={14} color={theme.colors.info} style={{ transform: [{ rotate: showAllEvents ? "180deg" : "0deg" }] }} />
              </Pressable>
            ) : null}
          </>
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
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4
  }
});
