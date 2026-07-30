import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CaretDown, Gear, MagnifyingGlass } from "phosphor-react-native";

import { apiClient } from "../api/client";
import { GroupTypeAvatar } from "../components/GroupTypeAvatar";
import { InlineNotice } from "../components/InlineNotice";
import { Screen } from "../components/Screen";
import { ThemedText } from "../components/ThemedText";
import { colorWithAlpha, useTheme } from "../theme";
import type { ExpenseRow, GroupType } from "../types/domain";
import type { AppNavigation } from "../types/navigation";
import { formatMoney } from "../utils/money";

type TimeFilter = "this_month" | "last_30_days" | "this_year" | "all_time";
type SortOption = "latest" | "oldest" | "highest";

const TIME_FILTERS: Array<{ label: string; value: TimeFilter }> = [
  { label: "This month", value: "this_month" },
  { label: "Last 30 days", value: "last_30_days" },
  { label: "This year", value: "this_year" },
  { label: "All time", value: "all_time" }
];

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

  // Filter expenses by date, group, and search query
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const queryStr = search.trim().toLowerCase();

    return allExpenses.filter((expense) => {
      // Group filter
      if (selectedGroupId !== "all" && expense.groupId !== selectedGroupId) {
        return false;
      }

      // Search filter
      if (queryStr) {
        const matchesName = expense.description.toLowerCase().includes(queryStr);
        const matchesGroup = expense.groupName.toLowerCase().includes(queryStr);
        const matchesNotes = expense.notes ? expense.notes.toLowerCase().includes(queryStr) : false;
        if (!matchesName && !matchesGroup && !matchesNotes) {
          return false;
        }
      }

      // Time filter
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
      return true; // all_time
    });
  }, [allExpenses, selectedGroupId, search, timeFilter]);

  // Sort expenses based on sortOrder
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

  // Aggregate statistics
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

  return (
    <Screen refreshing={groupsQuery.isRefetching || allExpensesQuery.isRefetching} onRefresh={() => void allExpensesQuery.refetch()}>
      {/* Top Action Bar (Back & Settings) */}
      <View style={styles.topBar}>
        <Pressable
          style={[styles.topIconBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline }]}
          onPress={() => navigation.back()}
          hitSlop={8}
        >
          <ArrowLeft size={16} color={theme.colors.ink} />
        </Pressable>

        <Pressable
          style={[styles.topIconBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline }]}
          onPress={() => navigation.go("settings")}
          hitSlop={8}
        >
          <Gear size={16} color={theme.colors.ink} />
          <View style={styles.settingsDot} />
        </Pressable>
      </View>

      {/* Screen Title Block */}
      <View style={styles.headerBlock}>
        <ThemedText variant="caption" tone="muted" style={styles.subTitleText}>
          COMBINED GROUP HISTORY
        </ThemedText>
        <ThemedText variant="title" style={styles.mainTitleText}>
          All expenses
        </ThemedText>
      </View>

      {/* Top Summary Cards (Mockup matching) */}
      <View style={styles.statsGrid}>
        {/* Total spend */}
        <View
          style={[
            styles.statCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.hairline
            },
            styles.cardShadowStyle
          ]}
        >
          <View style={[styles.statIconBadge, { backgroundColor: theme.mode === "dark" ? "#451A03" : "#FEF3C7" }]}>
            <ThemedText style={{ color: "#D97706", fontWeight: "900", fontSize: 16 }}>₹</ThemedText>
          </View>
          <ThemedText variant="caption" tone="muted" style={styles.statLabelText}>
            Total spend
          </ThemedText>
          <ThemedText variant="bodyMedium" numberOfLines={1} adjustsFontSizeToFit style={styles.statValueText}>
            {formatMoney(totalSpendMinor)}
          </ThemedText>
        </View>

        {/* Count */}
        <View
          style={[
            styles.statCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.hairline
            },
            styles.cardShadowStyle
          ]}
        >
          <View style={[styles.statIconBadge, { backgroundColor: theme.mode === "dark" ? "#3B0764" : "#F3E8FF" }]}>
            <ThemedText style={{ color: "#9333EA", fontWeight: "900", fontSize: 16 }}>#</ThemedText>
          </View>
          <ThemedText variant="caption" tone="muted" style={styles.statLabelText}>
            Count
          </ThemedText>
          <ThemedText variant="bodyMedium" numberOfLines={1} style={styles.statValueText}>
            {filteredExpenses.length}
          </ThemedText>
        </View>

        {/* Average */}
        <View
          style={[
            styles.statCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.hairline
            },
            styles.cardShadowStyle
          ]}
        >
          <View style={[styles.statIconBadge, { backgroundColor: theme.mode === "dark" ? "#042F2E" : "#CCFBF1" }]}>
            <ThemedText style={{ color: "#0D9488", fontWeight: "900", fontSize: 16 }}>~</ThemedText>
          </View>
          <ThemedText variant="caption" tone="muted" style={styles.statLabelText}>
            Average
          </ThemedText>
          <ThemedText variant="bodyMedium" numberOfLines={1} adjustsFontSizeToFit style={styles.statValueText}>
            {formatMoney(avgSpendMinor)}
          </ThemedText>
        </View>
      </View>

      {/* Rounded Search Bar */}
      <View
        style={[
          styles.searchBarContainer,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.hairline
          },
          styles.cardShadowStyle
        ]}
      >
        <MagnifyingGlass size={18} color={theme.colors.inkMuted} weight="bold" style={styles.searchIcon} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search expenses by title or group"
          placeholderTextColor={theme.colors.inkFaint}
          style={[theme.typography.body, styles.searchInput, { color: theme.colors.ink }]}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filter Chips Horizontal Scroll */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
        {TIME_FILTERS.map((option) => {
          const active = option.value === timeFilter;
          const bg = active ? "#4F46E5" : theme.colors.surface;
          const border = active ? "#4F46E5" : theme.colors.hairline;
          const textClr = active ? "#FFFFFF" : theme.colors.ink;
          const caretClr = active ? "#FFFFFF" : theme.colors.inkMuted;

          return (
            <Pressable
              key={option.value}
              onPress={() => setTimeFilter(option.value)}
              style={[
                styles.filterChipPill,
                {
                  backgroundColor: bg,
                  borderColor: border
                },
                !active && styles.cardShadowStyle
              ]}
            >
              <ThemedText variant="caption" style={{ color: textClr, fontWeight: active ? "700" : "600", fontSize: 13 }}>
                {option.label}
              </ThemedText>
              <CaretDown size={12} color={caretClr} weight="bold" />
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Section Header: Expenses (Count) & Sort dropdown */}
      <View style={styles.sectionHeaderRow}>
        <ThemedText variant="title" style={styles.sectionTitleText}>
          Expenses ({filteredExpenses.length})
        </ThemedText>

        <Pressable onPress={toggleSortOrder} style={styles.sortTrigger} hitSlop={8}>
          <ThemedText variant="bodySm" style={{ color: "#4F46E5", fontWeight: "700" }}>
            Sort {sortOrder === "latest" ? "Latest" : sortOrder === "highest" ? "Highest" : "Oldest"}
          </ThemedText>
          <CaretDown size={14} color="#4F46E5" weight="bold" />
        </Pressable>
      </View>

      {/* Loading state or notice */}
      {allExpensesQuery.isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.colors.inkMuted} />
        </View>
      ) : allExpensesQuery.error ? (
        <InlineNotice title="Could not load expenses" body={allExpensesQuery.error.message} tone="owe" />
      ) : null}

      {/* Expenses Cards List */}
      {sortedExpenses.length ? (
        <View style={styles.expensesListStack}>
          {visibleExpenses.map((expense) => {
            const dateFormatted = new Date(expense.expenseDate).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric"
            });

            return (
              <Pressable
                key={expense.id}
                onPress={() => openExpense(expense)}
                style={[
                  styles.expenseCardItem,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.hairline
                  },
                  styles.cardShadowStyle
                ]}
              >
                {/* Group Type Icon Avatar */}
                <GroupTypeAvatar groupType={expense.groupType} size={44} />

                {/* Center Title & Group Tag */}
                <View style={styles.expenseCardCenter}>
                  <ThemedText variant="bodyMedium" numberOfLines={1} style={styles.expenseCardTitle}>
                    {expense.description}
                  </ThemedText>

                  <View style={[styles.groupNamePill, { backgroundColor: colorWithAlpha("#4F46E5", 0.1) }]}>
                    <ThemedText variant="caption" style={{ color: "#4F46E5", fontWeight: "700", fontSize: 11 }}>
                      {expense.groupName}
                    </ThemedText>
                  </View>
                </View>

                {/* Right Amount & Date */}
                <View style={styles.expenseCardRight}>
                  <ThemedText variant="bodyMedium" style={styles.expenseCardAmount}>
                    {formatMoney(expense.totalAmountMinor, expense.currencyCode)}
                  </ThemedText>
                  <ThemedText variant="caption" tone="muted" style={{ fontSize: 12 }}>
                    {dateFormatted}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}

          {/* See All / Show Less Toggle Button */}
          {hasMore ? (
            <Pressable
              onPress={() => setShowAll((prev) => !prev)}
              style={[
                styles.seeAllButton,
                {
                  borderColor: theme.colors.hairline,
                  backgroundColor: colorWithAlpha("#4F46E5", theme.mode === "dark" ? 0.16 : 0.08)
                }
              ]}
            >
              <ThemedText variant="bodySm" style={{ color: "#4F46E5", fontWeight: "700" }}>
                {showAll ? "Show less" : `See all (${sortedExpenses.length})`}
              </ThemedText>
              <CaretDown size={14} color="#4F46E5" style={{ transform: [{ rotate: showAll ? "180deg" : "0deg" }] }} />
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.emptyStateWrap}>
          <ThemedText variant="bodyMedium" tone="muted">
            {search || timeFilter !== "all_time" ? "No matching expenses found." : "No expenses created yet."}
          </ThemedText>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16
  },
  topIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  settingsDot: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4F46E5"
  },
  headerBlock: {
    marginBottom: 18
  },
  subTitleText: {
    letterSpacing: 0.8,
    fontWeight: "700",
    fontSize: 11,
    marginBottom: 2
  },
  mainTitleText: {
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 34
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18
  },
  statCard: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 22,
    borderWidth: 1,
    gap: 4
  },
  statIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4
  },
  statLabelText: {
    fontSize: 13,
    fontWeight: "500"
  },
  statValueText: {
    fontWeight: "800",
    fontSize: 18
  },
  searchBarContainer: {
    minHeight: 52,
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    marginBottom: 18
  },
  searchIcon: {
    marginRight: 10
  },
  searchInput: {
    flex: 1,
    padding: 0,
    fontSize: 14
  },
  filterChipRow: {
    gap: 10,
    marginBottom: 20
  },
  filterChipPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14
  },
  sectionTitleText: {
    fontSize: 22,
    fontWeight: "800"
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
  expensesListStack: {
    gap: 12,
    marginBottom: 20
  },
  expenseCardItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12
  },
  expenseCardCenter: {
    flex: 1,
    gap: 4,
    justifyContent: "center"
  },
  expenseCardTitle: {
    fontWeight: "700",
    fontSize: 16
  },
  groupNamePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8
  },
  expenseCardRight: {
    alignItems: "flex-end",
    gap: 4,
    justifyContent: "center"
  },
  expenseCardAmount: {
    fontWeight: "800",
    fontSize: 17
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4
  },
  emptyStateWrap: {
    paddingVertical: 32,
    alignItems: "center"
  },
  cardShadowStyle: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2
  }
});
