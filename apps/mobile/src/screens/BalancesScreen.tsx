import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Scales } from "phosphor-react-native";

import { apiClient } from "../api/client";
import { Button } from "../components/Button";
import { DataSurface } from "../components/DataSurface";
import { EmptyState } from "../components/EmptyState";
import { GroupSelector } from "../components/GroupSelector";
import { InlineNotice } from "../components/InlineNotice";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { ThemedText } from "../components/ThemedText";
import { useTheme } from "../theme";
import { AppNavigation } from "../types/navigation";
import { formatSignedMoney } from "../utils/money";
import { buildGroupDisplayLookups, enrichBalanceRows, enrichSettlementSuggestions } from "../utils/displayNames";

export function BalancesScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const groupsQuery = useQuery({ queryKey: ["groups"], queryFn: () => apiClient.listGroups() });
  const groups = groupsQuery.data ?? [];
  const selectedGroupId = navigation.selectedGroupId ?? groups[0]?.id;
  const groupQuery = useQuery({
    queryKey: ["group", selectedGroupId],
    queryFn: () => apiClient.getGroup(selectedGroupId as string),
    enabled: Boolean(selectedGroupId)
  });
  const balancesQuery = useQuery({
    queryKey: ["balances", selectedGroupId],
    queryFn: () => apiClient.getBalances(selectedGroupId as string),
    enabled: Boolean(selectedGroupId)
  });
  const suggestionsQuery = useQuery({
    queryKey: ["settlementSuggestions", selectedGroupId],
    queryFn: () => apiClient.getSettlementSuggestions(selectedGroupId as string),
    enabled: Boolean(selectedGroupId)
  });

  useEffect(() => {
    if (!navigation.selectedGroupId && groups[0]?.id) {
      navigation.setSelectedGroupId(groups[0].id);
    }
  }, [groups, navigation]);

  const lookups = useMemo(() => (groupQuery.data ? buildGroupDisplayLookups(groupQuery.data) : undefined), [groupQuery.data]);
  const balances = useMemo(
    () => (balancesQuery.data && lookups ? enrichBalanceRows(balancesQuery.data, lookups) : balancesQuery.data ?? []),
    [balancesQuery.data, lookups]
  );
  const suggestions = useMemo(
    () => (suggestionsQuery.data && lookups ? enrichSettlementSuggestions(suggestionsQuery.data, lookups) : suggestionsQuery.data ?? []),
    [lookups, suggestionsQuery.data]
  );
  const allSettled =
    Boolean(selectedGroupId) &&
    !balancesQuery.isLoading &&
    !balancesQuery.error &&
    (balances.length === 0 || balances.every((balance) => balance.balanceMinor === 0));
  const refreshing =
    groupsQuery.isRefetching || groupQuery.isRefetching || balancesQuery.isRefetching || suggestionsQuery.isRefetching;

  async function refreshScreen() {
    await Promise.all([
      groupsQuery.refetch(),
      selectedGroupId ? groupQuery.refetch() : Promise.resolve(),
      selectedGroupId ? balancesQuery.refetch() : Promise.resolve(),
      selectedGroupId ? suggestionsQuery.refetch() : Promise.resolve()
    ]);
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refreshScreen()}>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <ThemedText variant="caption" tone="muted">
            Explainability
          </ThemedText>
          <ThemedText variant="title">Balances and suggestions</ThemedText>
        </View>
        <Button label="Settle" variant="secondary" onPress={() => navigation.go("settlement")} />
      </View>

      {groups.length ? <GroupSelector groups={groups} selectedGroupId={selectedGroupId} onSelect={navigation.setSelectedGroupId} /> : null}
      {!selectedGroupId ? <EmptyState title="No group selected" body="Create or import a group before reviewing balances." action={{ label: "Groups", onPress: () => navigation.go("groups") }} /> : null}
      {balancesQuery.error ? <InlineNotice title="Balances could not load" body={balancesQuery.error.message} tone="owe" /> : null}

      <View style={styles.section}>
        <SectionHeader title="Participant balances" />
        {allSettled ? (
          <EmptyState title="Everyone is settled" body="No outstanding balances in this group right now." />
        ) : balances.length ? (
          <DataSurface>
            {balances.map((balance) => (
              <View key={`${balance.participantId}-${balance.currencyCode}`} style={[styles.row, { borderBottomColor: theme.colors.hairline }]}>
                <View style={styles.titleBlock}>
                  <ThemedText variant="bodyMedium">{balance.displayName}</ThemedText>
                  <ThemedText variant="bodySm" tone="muted">
                    {balance.explanation || (balance.balanceMinor >= 0 ? "Net creditor in this group" : "Net debtor in this group")}
                  </ThemedText>
                </View>
                <ThemedText variant="amount" tone={balance.balanceMinor >= 0 ? "receive" : "owe"} align="right">
                  {formatSignedMoney(balance.balanceMinor, balance.currencyCode)}
                </ThemedText>
              </View>
            ))}
          </DataSurface>
        ) : balancesQuery.isLoading ? (
          <EmptyState title="Loading balances" body="Fetching server projections for this group." />
        ) : (
          <EmptyState title="No balances yet" body="Balances are server projections and appear after ledger events are accepted." />
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Why this payment?" />
        {suggestionsQuery.error ? <InlineNotice title="Suggestions could not load" body={suggestionsQuery.error.message} tone="owe" /> : null}
        {allSettled ? (
          <EmptyState title="Nothing to settle" body="Everyone is settled, so there are no payment suggestions." />
        ) : suggestions.length ? (
          <DataSurface>
            {suggestions.map((suggestion) => (
              <View key={suggestion.id} style={[styles.suggestion, { borderBottomColor: theme.colors.hairline }]}>
                <View style={styles.suggestionHeader}>
                  <Scales size={22} color={theme.colors.confirmed} weight="duotone" />
                  <View style={styles.titleBlock}>
                    <ThemedText variant="bodyMedium">
                      {suggestion.payerName} pays {suggestion.payeeName}
                    </ThemedText>
                    <ThemedText variant="bodySm" tone="muted">
                      {suggestion.explanation}
                    </ThemedText>
                  </View>
                  <ThemedText variant="amount" tone="owe" align="right">
                    {formatSignedMoney(-suggestion.amountMinor, suggestion.currencyCode)}
                  </ThemedText>
                </View>
                <Button
                  label="Use suggestion"
                  variant="secondary"
                  onPress={() => {
                    navigation.go("settlement");
                  }}
                />
              </View>
            ))}
          </DataSurface>
        ) : (
          <EmptyState title="No settlement suggestion" body="The backend returns suggestions once balances are non-zero." />
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
  headerTitle: {
    flex: 1,
    minWidth: 0
  },
  section: {
    gap: 12
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderBottomWidth: 1,
    gap: 12
  },
  titleBlock: {
    flex: 1,
    gap: 4
  },
  suggestion: {
    padding: 14,
    borderBottomWidth: 1,
    gap: 12
  },
  suggestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  }
});
