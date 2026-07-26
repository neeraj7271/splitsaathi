import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  Bell,
  CalendarBlank,
  CloudArrowUp,
  FileArrowDown,
  Receipt,
  Scales,
  UserPlus,
  UsersThree,
  Wallet
} from "phosphor-react-native";

import { apiClient } from "../api/client";
import { BalanceHeroCard } from "../components/BalanceHeroCard";
import { BrandLogo } from "../components/BrandLogo";
import { EmptyState } from "../components/EmptyState";
import { GroupSummaryCard } from "../components/GroupSummaryCard";
import { InlineNotice } from "../components/InlineNotice";
import { QuickActionGrid } from "../components/QuickActionGrid";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { ThemedText } from "../components/ThemedText";
import { UserAvatar } from "../components/UserAvatar";
import { colorWithAlpha, useTheme } from "../theme";
import { ActivityRowDto } from "../types/domain";
import { AppNavigation } from "../types/navigation";
import { isLedgerActivityEvent } from "../utils/activityFeed";
import { formatActivityTitle, humanizeEventType } from "../utils/displayNames";
import { formatMoney, formatSignedMoney } from "../utils/money";

const HOME_ACTIVITY_LIMIT = 8;
const HOME_GROUPS_PREVIEW = 5;

export function HomeScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const groupsQuery = useQuery({ queryKey: ["groups"], queryFn: () => apiClient.listGroups() });
  const profileQuery = useQuery({ queryKey: ["me"], queryFn: () => apiClient.getMe() });
  const friendsQuery = useQuery({ queryKey: ["friends"], queryFn: () => apiClient.listFriends() });
  const groups = groupsQuery.data ?? [];
  const activeGroups = groups.filter((group) => group.state === "active");

  const activityQueries = useQueries({
    queries: activeGroups.slice(0, 6).map((group) => ({
      queryKey: ["groupActivity", group.id, { limit: HOME_ACTIVITY_LIMIT, feed: "ledger", home: true }],
      queryFn: () => apiClient.getGroupActivity(group.id, { limit: HOME_ACTIVITY_LIMIT, feed: "ledger" }),
      enabled: activeGroups.length > 0
    }))
  });

  const recentActivity = useMemo(() => {
    const groupById = new Map(activeGroups.map((group) => [group.id, group]));
    const rows: Array<ActivityRowDto & { groupName?: string; groupImageUrl?: string | null }> = [];
    for (const query of activityQueries) {
      for (const item of query.data?.items ?? []) {
        if (!isLedgerActivityEvent(item.activityType)) {
          continue;
        }
        const group = groupById.get(item.groupId);
        rows.push({
          ...item,
          groupName: group?.name,
          groupImageUrl: group?.imageUrl
        });
      }
    }
    return rows
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, HOME_ACTIVITY_LIMIT);
  }, [activeGroups, activityQueries]);

  const netBalance = activeGroups.reduce((total, group) => total + (group.netBalanceMinor ?? 0), 0);
  const owingGroupCount = activeGroups.filter((group) => (group.netBalanceMinor ?? 0) < 0).length;
  const owedGroupCount = activeGroups.filter((group) => (group.netBalanceMinor ?? 0) > 0).length;
  const pendingProofs = groups.reduce((total, group) => total + (group.pendingProofCount ?? 0), 0);
  const friendsCount = friendsQuery.data?.length ?? 0;
  const monthlySpendMinor = useMemo(() => sumThisMonthSpend(recentActivity), [recentActivity]);

  const refreshing =
    groupsQuery.isRefetching ||
    profileQuery.isRefetching ||
    friendsQuery.isRefetching ||
    activityQueries.some((query) => query.isRefetching);

  const displayName = profileQuery.data?.displayName?.trim() || "there";
  // First token only — e.g. "Neeraj Suman 766" → "Neeraj"
  const firstName = displayName.split(/\s+/)[0] || "there";

  async function refreshScreen() {
    await Promise.all([
      groupsQuery.refetch(),
      profileQuery.refetch(),
      friendsQuery.refetch(),
      ...activityQueries.map((query) => query.refetch())
    ]);
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refreshScreen()}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.brandRow}>
            <View style={styles.markClip}>
              <BrandLogo variant="mark" size={28} />
            </View>
            <ThemedText variant="section" style={styles.brandName}>
              SplitSaathi
            </ThemedText>
          </View>
          <View style={styles.greetingBlock}>
            <ThemedText variant="title">
              {greetingForNow()}, {firstName} 👋
            </ThemedText>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => navigation.go("notificationSettings")}
            style={[styles.iconButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline }, theme.cardShadow]}
          >
            <Bell size={20} color={theme.colors.ink} weight="duotone" />
            {pendingProofs > 0 ? <View style={[styles.badge, { backgroundColor: theme.colors.owe }]} /> : null}
          </Pressable>
          <Pressable onPress={() => navigation.go("profile")} style={styles.profileButton}>
            <UserAvatar displayName={displayName} avatarUrl={profileQuery.data?.avatarUrl} size={36} />
          </Pressable>
        </View>
      </View>

      <BalanceHeroCard
        label="Total Balance"
        amountMinor={netBalance}
        currencyCode="INR"
        subtitle={balanceSubtitle(netBalance, owingGroupCount, owedGroupCount)}
        primaryAction={{ label: "Settle Up", onPress: () => navigation.go("settlement") }}
        secondaryAction={{ label: "View Balances", onPress: () => navigation.go("balances") }}
      />

      <View style={styles.statsRow}>
        <StatCard
          icon={UsersThree}
          tint="#8B5CF6"
          label={`${activeGroups.length} Group${activeGroups.length === 1 ? "" : "s"}`}
          onPress={() => navigation.go("groups")}
        />
        <StatCard
          icon={UserPlus}
          tint="#22C55E"
          label={`${friendsCount} Friend${friendsCount === 1 ? "" : "s"}`}
          onPress={() => navigation.go("friends")}
        />
        <StatCard
          icon={Wallet}
          tint="#F59E0B"
          label={`${formatMoney(monthlySpendMinor)} This Month`}
          onPress={() => navigation.go("audit")}
        />
      </View>

      <QuickActionGrid
        actions={[
          { label: "Add Expense", icon: Receipt, tint: "#8B5CF6", onPress: () => navigation.go("expense") },
          { label: "Settle", icon: Scales, tint: "#0D9488", onPress: () => navigation.go("settlement") },
          { label: "Recurring", icon: CalendarBlank, tint: "#3B82F6", onPress: () => navigation.go("recurring") },
          { label: "Sync", icon: CloudArrowUp, tint: "#A855F7", onPress: () => navigation.go("offline") },
          { label: "Import", icon: FileArrowDown, tint: "#F59E0B", onPress: () => navigation.go("importExport") }
        ]}
      />

      {groupsQuery.error ? <InlineNotice title="Groups could not load" body={groupsQuery.error.message} tone="owe" /> : null}

      <View style={styles.section}>
        <SectionHeader
          title="Your Groups"
          action={
            <Pressable onPress={() => navigation.go("groups")} hitSlop={8} style={styles.seeAll}>
              <ThemedText variant="bodySm" tone="info">
                See All
              </ThemedText>
            </Pressable>
          }
        />
        {activeGroups.length ? (
          <View style={styles.groupList}>
            {activeGroups.slice(0, HOME_GROUPS_PREVIEW).map((group) => (
              <GroupSummaryCard
                key={group.id}
                group={group}
                onPress={() => {
                  navigation.setSelectedGroupId(group.id);
                  navigation.go("groupDetail");
                }}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            title="Create your first group"
            body="Start a flat, trip, couple, or event ledger without asking for contacts first."
            action={{ label: "Create group", onPress: () => navigation.go("groups") }}
          />
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Recent Activity"
          action={
            <Pressable
              onPress={() => {
                if (activeGroups[0]?.id) {
                  navigation.setSelectedGroupId(activeGroups[0].id);
                }
                navigation.go("groupDetail");
              }}
              hitSlop={8}
              style={styles.seeAll}
            >
              <ThemedText variant="bodySm" tone="info">
                View All
              </ThemedText>
            </Pressable>
          }
        />
        {recentActivity.length ? (
          <View style={styles.groupList}>
            {recentActivity.slice(0, 5).map((item) => (
              <HomeActivityCard
                key={item.id}
                item={item}
                onPress={() => {
                  navigation.setSelectedGroupId(item.groupId);
                  navigation.go("groupDetail");
                }}
              />
            ))}
          </View>
        ) : (
          <EmptyState title="No ledger activity yet" body="Recorded expenses and completed payments will appear here." />
        )}
      </View>
    </Screen>
  );
}

function StatCard({
  icon: Icon,
  tint,
  label,
  onPress
}: {
  icon: React.ComponentType<{ size?: number; color?: string; weight?: "duotone" | "bold" | "regular" | "fill" }>;
  tint: string;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.statCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.hairline,
          borderRadius: theme.radius.md,
          borderWidth: theme.mode === "light" ? 0 : 1
        },
        theme.cardShadow
      ]}
    >
      <View style={[styles.statIcon, { backgroundColor: colorWithAlpha(tint, theme.mode === "dark" ? 0.22 : 0.12) }]}>
        <Icon size={18} color={tint} weight="duotone" />
      </View>
      <ThemedText variant="caption" numberOfLines={2} style={styles.statLabel}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function HomeActivityCard({
  item,
  onPress
}: {
  item: ActivityRowDto & { groupName?: string; groupImageUrl?: string | null };
  onPress: () => void;
}) {
  const theme = useTheme();
  const amount = item.amountMinor ?? 0;
  const amountTone = amount >= 0 ? "receive" : "owe";
  const amountBg = colorWithAlpha(amount >= 0 ? theme.colors.receive : theme.colors.owe, theme.mode === "dark" ? 0.2 : 0.12);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.activityCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.hairline,
          borderRadius: theme.radius.md,
          borderWidth: theme.mode === "light" ? 0 : 1
        },
        theme.cardShadow
      ]}
    >
      <UserAvatar
        displayName={item.groupName || formatActivityTitle(item.title)}
        avatarUrl={item.groupImageUrl}
        size={44}
      />
      <View style={styles.activityMeta}>
        <ThemedText variant="bodyMedium" numberOfLines={1}>
          {formatActivityTitle(item.title)}
        </ThemedText>
        <ThemedText variant="bodySm" tone="muted" numberOfLines={1}>
          {item.body || humanizeEventType(item.activityType)}
          {item.groupName ? ` · ${item.groupName}` : ""}
        </ThemedText>
        <ThemedText variant="caption" tone="faint">
          {formatActivityWhen(item.occurredAt)}
        </ThemedText>
      </View>
      {typeof item.amountMinor === "number" ? (
        <View style={[styles.amountPill, { backgroundColor: amountBg }]}>
          <ThemedText variant="amountSm" tone={amountTone}>
            {formatSignedMoney(item.amountMinor, item.currencyCode)}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

function greetingForNow(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) {
    return "Good Morning";
  }
  if (hour < 17) {
    return "Good Afternoon";
  }
  return "Good Evening";
}

function balanceSubtitle(netBalance: number, owingGroupCount: number, owedGroupCount: number) {
  if (netBalance < 0) {
    return `You owe across ${owingGroupCount} group${owingGroupCount === 1 ? "" : "s"}`;
  }
  if (netBalance > 0) {
    return `You're owed across ${owedGroupCount} group${owedGroupCount === 1 ? "" : "s"}`;
  }
  return "All settled across your groups";
}

function formatRelativeDay(iso?: string) {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startToday.getTime() - startThat.getTime()) / 86_400_000);
  if (diffDays <= 0) {
    return "Today";
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function formatActivityWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const day = formatRelativeDay(iso);
  const time = date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return `${day}, ${time}`;
}

function sumThisMonthSpend(items: ActivityRowDto[]) {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return items.reduce((total, item) => {
    if (typeof item.amountMinor !== "number") {
      return total;
    }
    const occurred = new Date(item.occurredAt);
    if (occurred.getMonth() !== month || occurred.getFullYear() !== year) {
      return total;
    }
    // Home "This Month" is spending volume — use absolute amount.
    return total + Math.abs(item.amountMinor);
  }, 0);
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  headerLeft: {
    flex: 1,
    gap: 6
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  markClip: {
    borderRadius: 8,
    overflow: "hidden"
  },
  brandName: {
    letterSpacing: -0.2
  },
  greetingBlock: {
    gap: 0
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 0
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1
  },
  badge: {
    position: "absolute",
    top: 7,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 999
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  statsRow: {
    flexDirection: "row",
    gap: 8
  },
  statCard: {
    flex: 1,
    minHeight: 72,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
    alignItems: "flex-start",
    justifyContent: "space-between"
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  statLabel: {
    width: "100%"
  },
  section: {
    gap: 8
  },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2
  },
  groupList: {
    gap: 8
  },
  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  activityMeta: {
    flex: 1,
    gap: 1,
    minWidth: 0
  },
  amountPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  }
});
