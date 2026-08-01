import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarBlank,
  CaretDown,
  ChartBar,
  Clock,
  Hash,
  MagnifyingGlass,
  Receipt,
  SquaresFour,
  Wallet
} from "phosphor-react-native";

import { apiClient } from "../api/client";
import { DataSurface } from "../components/DataSurface";
import { EmptyState } from "../components/EmptyState";
import { GroupTypeAvatar } from "../components/GroupTypeAvatar";
import { InlineNotice } from "../components/InlineNotice";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionHeader } from "../components/SectionHeader";
import { ThemedText } from "../components/ThemedText";
import { colorWithAlpha, useTheme } from "../theme";
import type { ExpenseRow, GroupType } from "../types/domain";
import type { AppNavigation } from "../types/navigation";
import { formatMoney } from "../utils/money";
import { activeGroupsByOutstandingBalance } from "../utils/groupSort";

type TimeFilter = "this_month" | "last_30_days" | "this_year" | "all_time";
type SortOption = "latest" | "oldest" | "highest";

const TIME_FILTERS: Array<{
  label: string;
  value: TimeFilter;
  Icon: typeof CalendarBlank;
  accent: "confirmed" | "info" | "pending" | "receive";
}> = [
  { label: "This month", value: "this_month", Icon: CalendarBlank, accent: "confirmed" },
  { label: "Last 30 days", value: "last_30_days", Icon: Clock, accent: "info" },
  { label: "This year", value: "this_year", Icon: ChartBar, accent: "pending" },
  { label: "All time", value: "all_time", Icon: SquaresFour, accent: "receive" }
];

const SORT_LABELS: Record<SortOption, string> = {
  latest: "Latest",
  oldest: "Oldest",
  highest: "Highest"
};

export interface EnrichedExpense extends ExpenseRow {
  groupName: string;
  groupType?: GroupType;
}

export function AllExpensesScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("this_month");
  const [sortOrder, setSortOrder] = useState<SortOption>("latest");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 5;

  const groupsQuery = useQuery({
    queryKey: ["groups"],
    queryFn: () => apiClient.listGroups()
  });
  const groups = groupsQuery.data ?? [];
  const selectorGroups = useMemo(() => activeGroupsByOutstandingBalance(groups), [groups]);

  const allExpensesQuery = useQuery({
    queryKey: ["allGroupExpenses", groups.map((g) => g.id).join(",")],
    enabled: groups.length > 0,
    queryFn: async () => {
      const results: EnrichedExpense[] = [];
      await Promise.all(
        groups.map(async (group) => {
          try {
            const expenses = await apiClient.listExpenses(group.id);
            for (const expense of expenses) {
              if (expense.state !== "voided") {
                results.push({
                  ...expense,
                  groupName: group.name,
                  groupType: group.groupType
                });
              }
            }
          } catch {
            // Ignore single group fetch errors gracefully
          }
        })
      );
      return results;
    }
  });

  const allExpenses = allExpensesQuery.data ?? [];

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const queryStr = search.trim().toLowerCase();

    return allExpenses.filter((expense) => {
      if (selectedGroupId !== "all" && expense.groupId !== selectedGroupId) {
        return false;
      }

      if (queryStr) {
        const matchesName = expense.description.toLowerCase().includes(queryStr);
        const matchesGroup = expense.groupName.toLowerCase().includes(queryStr);
        const matchesNotes = expense.notes ? expense.notes.toLowerCase().includes(queryStr) : false;
        if (!matchesName && !matchesGroup && !matchesNotes) {
          return false;
        }
      }

      const expDate = new Date(expense.expenseDate);
      if (timeFilter === "this_month") {
        return expDate.getFullYear() === currentYear && expDate.getMonth() === currentMonth;
      }
      if (timeFilter === "last_30_days") {
        const diffMs = now.getTime() - expDate.getTime();
        return diffMs >= 0 && diffMs <= 30 * 24 * 60 * 60 * 1000;
      }
      if (timeFilter === "this_year") {
        return expDate.getFullYear() === currentYear;
      }
      return true;
    });
  }, [allExpenses, selectedGroupId, search, timeFilter]);

  const sortedExpenses = useMemo(() => {
    const list = [...filteredExpenses];
    if (sortOrder === "oldest") {
      return list.sort((a, b) => new Date(a.expenseDate).getTime() - new Date(b.expenseDate).getTime());
    }
    if (sortOrder === "highest") {
      return list.sort((a, b) => (b.totalAmountMinor ?? 0) - (a.totalAmountMinor ?? 0));
    }
    return list.sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime());
  }, [filteredExpenses, sortOrder]);

  const totalSpendMinor = useMemo(
    () => filteredExpenses.reduce((sum, item) => sum + (item.totalAmountMinor ?? 0), 0),
    [filteredExpenses]
  );

  const avgSpendMinor = useMemo(
    () => (filteredExpenses.length ? Math.round(totalSpendMinor / filteredExpenses.length) : 0),
    [totalSpendMinor, filteredExpenses.length]
  );

  const visibleExpenses = showAll ? sortedExpenses : sortedExpenses.slice(0, LIMIT);
  const hasMore = sortedExpenses.length > LIMIT;

  function toggleSortOrder() {
    setSortOrder((prev) => (prev === "latest" ? "highest" : prev === "highest" ? "oldest" : "latest"));
  }

  function openExpense(expense: EnrichedExpense) {
    navigation.setSelectedGroupId(expense.groupId);
    navigation.setSelectedExpenseId(expense.id);
    navigation.go("groupDetail");
  }

  const refreshing = groupsQuery.isRefetching || allExpensesQuery.isRefetching;

  return (
    <Screen refreshing={refreshing} onRefresh={() => void allExpensesQuery.refetch()}>
      <ScreenHeader
        navigation={navigation}
        fallbackRoute="home"
        caption="Combined group history"
        title="All expenses"
        trailing={
          <View
            style={[
              styles.headerIcon,
              {
                backgroundColor: colorWithAlpha(theme.colors.pending, theme.mode === "dark" ? 0.16 : 0.1),
                borderColor: colorWithAlpha(theme.colors.pending, 0.28),
                borderRadius: theme.radius.full
              }
            ]}
          >
            <Receipt size={20} color={theme.colors.pending} weight="duotone" />
          </View>
        }
      />

      <DataSurface elevated>
        <View style={styles.summaryRow}>
          <SummaryStat
            label="Total spend"
            value={formatMoney(totalSpendMinor)}
            Icon={Wallet}
            accent={theme.colors.pending}
          />
          <View style={[styles.summaryDivider, { backgroundColor: theme.colors.hairline }]} />
          <SummaryStat label="Count" value={String(filteredExpenses.length)} Icon={Hash} accent={theme.colors.info} />
          <View style={[styles.summaryDivider, { backgroundColor: theme.colors.hairline }]} />
          <SummaryStat
            label="Average"
            value={formatMoney(avgSpendMinor)}
            Icon={ChartBar}
            accent={theme.colors.confirmed}
          />
        </View>
      </DataSurface>

      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchField,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.hairline,
              borderRadius: theme.radius.md
            }
          ]}
        >
          <MagnifyingGlass size={18} color={theme.colors.inkMuted} weight="duotone" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by title, group, or notes"
            placeholderTextColor={theme.colors.inkFaint}
            style={[theme.typography.body, styles.searchInput, { color: theme.colors.ink }]}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {TIME_FILTERS.map((option) => {
          const active = option.value === timeFilter;
          const accent = theme.colors[option.accent];
          const Icon = option.Icon;
          return (
            <Pressable
              key={option.value}
              onPress={() => setTimeFilter(option.value)}
              style={[
                styles.filterChip,
                {
                  borderRadius: theme.radius.full,
                  borderColor: active ? accent : theme.colors.hairline,
                  backgroundColor: active
                    ? colorWithAlpha(accent, theme.mode === "dark" ? 0.16 : 0.08)
                    : theme.colors.surface
                }
              ]}
            >
              <Icon size={14} color={accent} weight="duotone" />
              <ThemedText variant="caption" style={{ color: active ? accent : theme.colors.inkMuted }}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      {selectorGroups.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <Pressable
            onPress={() => setSelectedGroupId("all")}
            style={[
              styles.filterChip,
              {
                borderRadius: theme.radius.full,
                borderColor: selectedGroupId === "all" ? theme.colors.confirmed : theme.colors.hairline,
                backgroundColor:
                  selectedGroupId === "all"
                    ? colorWithAlpha(theme.colors.confirmed, theme.mode === "dark" ? 0.16 : 0.08)
                    : theme.colors.surface
              }
            ]}
          >
            <SquaresFour size={14} color={theme.colors.confirmed} weight="duotone" />
            <ThemedText
              variant="caption"
              style={{ color: selectedGroupId === "all" ? theme.colors.confirmed : theme.colors.inkMuted }}
            >
              All groups
            </ThemedText>
          </Pressable>
          {selectorGroups.map((group) => {
            const active = selectedGroupId === group.id;
            return (
              <Pressable
                key={group.id}
                onPress={() => setSelectedGroupId(group.id)}
                style={[
                  styles.filterChip,
                  {
                    borderRadius: theme.radius.full,
                    borderColor: active ? theme.colors.info : theme.colors.hairline,
                    backgroundColor: active
                      ? colorWithAlpha(theme.colors.info, theme.mode === "dark" ? 0.16 : 0.08)
                      : theme.colors.surface
                  }
                ]}
              >
                <ThemedText variant="caption" style={{ color: active ? theme.colors.info : theme.colors.inkMuted }} numberOfLines={1}>
                  {group.name}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.section}>
        <SectionHeader
          title={`Expenses (${filteredExpenses.length})`}
          action={
            <Pressable onPress={toggleSortOrder} hitSlop={8} style={styles.sortTrigger}>
              <ThemedText variant="bodySm" tone="info">
                Sort {SORT_LABELS[sortOrder]}
              </ThemedText>
              <CaretDown size={14} color={theme.colors.info} weight="bold" />
            </Pressable>
          }
        />

        {allExpensesQuery.isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={theme.colors.inkMuted} />
          </View>
        ) : null}

        {allExpensesQuery.error ? (
          <InlineNotice title="Could not load expenses" body={allExpensesQuery.error.message} tone="owe" />
        ) : null}

        {sortedExpenses.length ? (
          <>
            <DataSurface elevated>
              {visibleExpenses.map((expense, index) => {
                const dateFormatted = new Date(expense.expenseDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric"
                });

                return (
                  <Pressable
                    key={expense.id}
                    onPress={() => openExpense(expense)}
                    style={[
                      styles.dataRow,
                      {
                        borderBottomColor: theme.colors.hairline,
                        borderBottomWidth: index < visibleExpenses.length - 1 ? 1 : 0
                      }
                    ]}
                  >
                    <GroupTypeAvatar groupType={expense.groupType} size={44} />
                    <View style={styles.titleBlock}>
                      <ThemedText variant="bodyMedium" numberOfLines={1}>
                        {expense.description}
                      </ThemedText>
                      <ThemedText variant="bodySm" tone="muted" numberOfLines={1}>
                        {expense.groupName}
                        {expense.category ? ` · ${expense.category}` : ""}
                      </ThemedText>
                      <ThemedText variant="caption" tone="faint">
                        {dateFormatted}
                      </ThemedText>
                    </View>
                    <View style={styles.trailing}>
                      <ThemedText variant="amountSm" align="right">
                        {formatMoney(expense.totalAmountMinor, expense.currencyCode)}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </DataSurface>

            {hasMore ? (
              <Pressable
                onPress={() => setShowAll((prev) => !prev)}
                style={[
                  styles.seeAllButton,
                  {
                    borderColor: theme.colors.hairline,
                    backgroundColor: colorWithAlpha(theme.colors.info, theme.mode === "dark" ? 0.16 : 0.08)
                  }
                ]}
              >
                <ThemedText variant="bodySm" style={{ color: theme.colors.info, fontWeight: "600" }}>
                  {showAll ? "Show less" : `See all (${sortedExpenses.length})`}
                </ThemedText>
                <CaretDown
                  size={14}
                  color={theme.colors.info}
                  style={{ transform: [{ rotate: showAll ? "180deg" : "0deg" }] }}
                />
              </Pressable>
            ) : null}
          </>
        ) : allExpensesQuery.isLoading ? null : (
          <EmptyState
            title={search || timeFilter !== "all_time" || selectedGroupId !== "all" ? "No matching expenses" : "No expenses yet"}
            body={
              search || timeFilter !== "all_time" || selectedGroupId !== "all"
                ? "Try another time range, group filter, or search term."
                : "Expenses from your groups will appear here once they are recorded."
            }
            action={
              selectorGroups.length
                ? {
                    label: "Add expense",
                    onPress: () => {
                      if (selectorGroups[0]?.id) {
                        navigation.setSelectedGroupId(selectorGroups[0].id);
                      }
                      navigation.setSelectedExpenseId(undefined);
                      navigation.go("expense");
                    }
                  }
                : {
                    label: "Create group",
                    onPress: () => navigation.go("groups")
                  }
            }
          />
        )}
      </View>
    </Screen>
  );
}

function SummaryStat({
  label,
  value,
  Icon,
  accent
}: {
  label: string;
  value: string;
  Icon: typeof Wallet;
  accent: string;
}) {
  const theme = useTheme();

  return (
    <View style={styles.summaryStat}>
      <View
        style={[
          styles.summaryIcon,
          {
            backgroundColor: colorWithAlpha(accent, theme.mode === "dark" ? 0.18 : 0.12),
            borderRadius: theme.radius.md
          }
        ]}
      >
        <Icon size={16} color={accent} weight="duotone" />
      </View>
      <ThemedText variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText variant="amountSm" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4
  },
  headerCopy: {
    flex: 1,
    gap: 2
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "stretch",
    padding: 14
  },
  summaryStat: {
    flex: 1,
    gap: 4,
    alignItems: "flex-start"
  },
  summaryIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2
  },
  summaryDivider: {
    width: 1,
    marginHorizontal: 10
  },
  searchRow: {
    marginTop: 4
  },
  searchField: {
    minHeight: 48,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14
  },
  searchInput: {
    flex: 1,
    padding: 0
  },
  filterRow: {
    gap: 8,
    paddingVertical: 2
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  section: {
    gap: 12
  },
  sortTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  loadingContainer: {
    paddingVertical: 24,
    alignItems: "center"
  },
  dataRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12
  },
  titleBlock: {
    flex: 1,
    gap: 3,
    minWidth: 0
  },
  trailing: {
    alignItems: "flex-end",
    justifyContent: "center",
    maxWidth: 108
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1
  }
});
