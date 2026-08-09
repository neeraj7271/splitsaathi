import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  BellRinging,
  CaretDown,
  CaretRight,
  Coins,
  DotsThreeVertical,
  Handshake,
  UsersThree
} from "phosphor-react-native";

import { apiClient } from "../api/client";
import { ActionSheet } from "../components/ActionSheet";
import { useAppDialog } from "../components/AppDialog";
import { EmptyState } from "../components/EmptyState";
import { friendAccent } from "../components/FriendSummaryCard";
import { InlineNotice } from "../components/InlineNotice";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionHeader } from "../components/SectionHeader";
import { ThemedText } from "../components/ThemedText";
import { UserAvatar } from "../components/UserAvatar";
import { colorWithAlpha, useTheme } from "../theme";
import type { FriendSharedGroup, FriendSummary, FriendTransaction } from "../types/domain";
import { AppNavigation } from "../types/navigation";
import { formatMoney, formatSignedMoney } from "../utils/money";

const GROUPS_PREVIEW = 3;
const TRANSACTIONS_PREVIEW = 5;

const GROUP_PALETTE = [
  { bg: "#F3E8FF", icon: "#9333EA" },
  { bg: "#EFF6FF", icon: "#2563EB" },
  { bg: "#FFF7ED", icon: "#EA580C" },
  { bg: "#ECFDF5", icon: "#059669" },
  { bg: "#FDF2F8", icon: "#DB2777" }
];

const GROUP_PALETTE_DARK = [
  { bg: "#2E1065", icon: "#C084FC" },
  { bg: "#1E3A8A", icon: "#60A5FA" },
  { bg: "#7C2D12", icon: "#FB923C" },
  { bg: "#064E3B", icon: "#34D399" },
  { bg: "#831843", icon: "#F472B6" }
];

function balanceHeadline(friend: FriendSummary) {
  if (friend.netMinor > 0) {
    return "They owe you";
  }
  if (friend.netMinor < 0) {
    return "You owe them";
  }
  if (friend.status === "no_expenses") {
    return "No expenses yet";
  }
  return "Settled up";
}

function balanceSubcopy(friend: FriendSummary) {
  if (friend.netMinor > 0) {
    return "They owe you overall";
  }
  if (friend.netMinor < 0) {
    return "You owe them overall";
  }
  if (friend.status === "no_expenses") {
    return "No shared expenses yet";
  }
  return "All settled across shared groups";
}

function formatTxDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function pickSettleGroup(groups: FriendSharedGroup[]) {
  const ranked = [...groups].sort((a, b) => Math.abs(b.pairNetMinor) - Math.abs(a.pairNetMinor));
  return ranked.find((group) => group.pairNetMinor !== 0) ?? ranked[0];
}

export function FriendDetailScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const { showDialog } = useAppDialog();
  const queryClient = useQueryClient();
  const friendUserId = navigation.selectedFriendUserId;
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAllGroups, setShowAllGroups] = useState(false);
  const [showAllTransactions, setShowAllTransactions] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["friend", friendUserId],
    queryFn: () => apiClient.getFriendDetail(friendUserId as string),
    enabled: Boolean(friendUserId)
  });

  const remind = useMutation({
    mutationFn: () => apiClient.remindFriend(friendUserId as string),
    onSuccess: () => {
      showDialog({
        title: "Reminder sent",
        message: "They’ll get a push notification if alerts are enabled.",
        tone: "success",
        primaryAction: { label: "OK" }
      });
      void queryClient.invalidateQueries({ queryKey: ["friend", friendUserId] });
    },
    onError: (error: Error) => {
      showDialog({
        title: "Could not send reminder",
        message: error.message,
        tone: "error",
        primaryAction: { label: "OK" }
      });
    }
  });

  const friend = detailQuery.data?.friend;
  const transactions = detailQuery.data?.transactions ?? [];
  const accent = friend ? friendAccent(friend, theme.colors) : theme.colors.confirmed;

  const visibleGroups = useMemo(() => {
    if (!friend) {
      return [];
    }
    return showAllGroups ? friend.sharedGroups : friend.sharedGroups.slice(0, GROUPS_PREVIEW);
  }, [friend, showAllGroups]);

  const visibleTransactions = useMemo(() => {
    return showAllTransactions ? transactions : transactions.slice(0, TRANSACTIONS_PREVIEW);
  }, [showAllTransactions, transactions]);

  function openGroup(groupId: string) {
    navigation.setSelectedGroupId(groupId);
    navigation.go("groupDetail");
  }

  function openSettle() {
    if (!friend) {
      return;
    }
    const target = pickSettleGroup(friend.sharedGroups);
    if (target) {
      navigation.setSelectedGroupId(target.groupId);
    }
    navigation.go("settlement");
  }

  function openTransaction(tx: FriendTransaction) {
    navigation.setSelectedGroupId(tx.groupId);
    if (tx.kind === "expense" && tx.expenseId) {
      navigation.setSelectedExpenseId(tx.expenseId);
      navigation.go("expense");
      return;
    }
    navigation.go("settlement");
  }

  return (
    <Screen refreshing={detailQuery.isRefetching} onRefresh={() => void detailQuery.refetch()}>
      <ScreenHeader
        navigation={navigation}
        fallbackRoute="friends"
        trailing={
          <Pressable
            onPress={() => setMenuOpen(true)}
            style={[styles.navIconButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline }]}
            accessibilityRole="button"
            accessibilityLabel="Friend options"
          >
            <DotsThreeVertical size={20} color={theme.colors.ink} weight="bold" />
          </Pressable>
        }
      />

      {!friendUserId ? <InlineNotice title="No friend selected" body="Go back and pick a friend." tone="owe" /> : null}
      {detailQuery.error ? <InlineNotice title="Could not load friend" body={detailQuery.error.message} tone="owe" /> : null}

      {friend ? (
        <>
          <View style={styles.profileHeader}>
            <UserAvatar
              displayName={friend.displayName}
              avatarUrl={friend.avatarUrl}
              size={76}
              accentColor={accent}
            />
            <View style={styles.profileMeta}>
              <ThemedText variant="title" style={styles.profileName}>
                {friend.displayName}
              </ThemedText>
              <ThemedText variant="bodySm" tone="muted" style={styles.profileSubtitle}>
                {friend.sharedGroupCount} shared group{friend.sharedGroupCount === 1 ? "" : "s"}
              </ThemedText>
              <View style={styles.profileActions}>
                {friend.netMinor > 0 ? (
                  <Pressable
                    onPress={() => remind.mutate()}
                    disabled={remind.isPending}
                    style={[
                      styles.actionPill,
                      {
                        borderColor: "#8B5CF6",
                        backgroundColor: theme.mode === "dark" ? "#2E1065" : "#F5F3FF"
                      }
                    ]}
                  >
                    <Bell size={16} color="#8B5CF6" weight="duotone" />
                    <ThemedText variant="bodySm" style={{ color: "#8B5CF6", fontWeight: "600" }}>
                      {remind.isPending ? "Sending..." : "Remind"}
                    </ThemedText>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={openSettle}
                  style={[
                    styles.actionPill,
                    {
                      borderColor: "#059669",
                      backgroundColor: theme.mode === "dark" ? "#064E3B" : "#ECFDF5"
                    }
                  ]}
                >
                  <Handshake size={16} color="#059669" weight="duotone" />
                  <ThemedText variant="bodySm" style={{ color: "#059669", fontWeight: "600" }}>
                    Settle
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: theme.mode === "dark" ? "#064E3B20" : "#F0FAF5",
                borderColor: theme.mode === "dark" ? "#064E3B50" : "#E6F7ED"
              }
            ]}
          >
            <View style={styles.heroCopy}>
              <ThemedText variant="bodySm" tone="muted" style={styles.heroLabel}>
                {balanceHeadline(friend)}
              </ThemedText>
              <ThemedText
                variant="balanceHero"
                style={[
                  styles.heroAmount,
                  {
                    color: friend.netMinor > 0 ? "#10B981" : friend.netMinor < 0 ? theme.colors.owe : theme.colors.confirmed
                  }
                ]}
              >
                {friend.netMinor === 0
                  ? formatMoney(0, friend.currencyCode)
                  : formatSignedMoney(friend.netMinor, friend.currencyCode)}
              </ThemedText>
              <ThemedText variant="bodySm" tone="muted" style={styles.heroSubtext}>
                {balanceSubcopy(friend)}
              </ThemedText>
            </View>
            <View style={styles.heroGraphic}>
              <View style={[styles.graphicGlow, { backgroundColor: theme.mode === "dark" ? "#065F46" : "#A7F3D0" }]}>
                <Coins size={46} color="#059669" weight="duotone" />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeader
              title="Shared groups"
              action={
                friend.sharedGroups.length > 0 ? (
                  <Pressable onPress={() => setShowAllGroups((prev) => !prev)}>
                    <ThemedText variant="bodySm" tone="confirmed" style={{ fontWeight: "600" }}>
                      See all ({friend.sharedGroups.length})
                    </ThemedText>
                  </Pressable>
                ) : null
              }
            />
            {friend.sharedGroups.length ? (
              <>
                <View style={styles.stack}>
                  {visibleGroups.map((group, idx) => {
                    const palette = (theme.mode === "dark" ? GROUP_PALETTE_DARK : GROUP_PALETTE)[idx % GROUP_PALETTE.length];
                    return (
                      <Pressable
                        key={group.groupId}
                        onPress={() => openGroup(group.groupId)}
                        style={[
                          styles.listCard,
                          {
                            backgroundColor: theme.colors.surface,
                            borderColor: theme.colors.hairline,
                            borderRadius: theme.radius.md,
                            borderWidth: theme.mode === "light" ? 0 : 1
                          },
                          theme.cardShadow
                        ]}
                      >
                        <View style={[styles.groupIconBox, { backgroundColor: palette.bg }]}>
                          <UsersThree size={22} color={palette.icon} weight="duotone" />
                        </View>
                        <View style={styles.cardCopy}>
                          <ThemedText variant="bodyMedium" numberOfLines={1} style={{ fontWeight: "600" }}>
                            {group.groupName}
                          </ThemedText>
                          <ThemedText variant="bodySm" tone="muted">
                            Tap to open group
                          </ThemedText>
                        </View>
                        <ThemedText
                          variant="amountSm"
                          tone={group.pairNetMinor >= 0 ? "receive" : "owe"}
                          align="right"
                          style={{ fontWeight: "600", color: group.pairNetMinor >= 0 ? "#10B981" : theme.colors.owe }}
                        >
                          {group.pairNetMinor === 0
                            ? formatMoney(0, group.currencyCode)
                            : formatSignedMoney(group.pairNetMinor, group.currencyCode)}
                        </ThemedText>
                        <CaretRight size={16} color="#10B981" weight="bold" />
                      </Pressable>
                    );
                  })}
                </View>
                {friend.sharedGroups.length > GROUPS_PREVIEW ? (
                  <Pressable
                    onPress={() => setShowAllGroups((value) => !value)}
                    style={[
                      styles.viewAllPill,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.hairline
                      }
                    ]}
                  >
                    <ThemedText variant="bodySm" tone="confirmed" style={{ fontWeight: "600" }}>
                      {showAllGroups
                        ? "Show fewer groups"
                        : `See all (${friend.sharedGroups.length})`}
                    </ThemedText>
                    <CaretDown size={14} color="#10B981" weight="bold" />
                  </Pressable>
                ) : null}
              </>
            ) : (
              <EmptyState title="No shared groups" body="You don’t share any groups with this friend yet." />
            )}
          </View>

          <View style={styles.section}>
            <SectionHeader title="Transactions with you" />
            {transactions.length ? (
              <>
                <View style={styles.stack}>
                  {visibleTransactions.map((tx) => {
                    const incoming = tx.amountMinor > 0;
                    const iconColor = incoming ? "#10B981" : theme.colors.owe;
                    const Icon = incoming ? ArrowUpRight : ArrowDownLeft;
                    return (
                      <Pressable
                        key={tx.id}
                        onPress={() => openTransaction(tx)}
                        style={[
                          styles.listCard,
                          {
                            backgroundColor: theme.colors.surface,
                            borderColor: theme.colors.hairline,
                            borderRadius: theme.radius.md,
                            borderWidth: theme.mode === "light" ? 0 : 1
                          },
                          theme.cardShadow
                        ]}
                      >
                        <View
                          style={[
                            styles.txIcon,
                            {
                              backgroundColor: colorWithAlpha(iconColor, theme.mode === "dark" ? 0.18 : 0.12),
                              borderRadius: theme.radius.full
                            }
                          ]}
                        >
                          <Icon size={18} color={iconColor} weight="bold" />
                        </View>
                        <View style={styles.cardCopy}>
                          <ThemedText variant="bodyMedium" numberOfLines={1} style={{ fontWeight: "600" }}>
                            {tx.description}
                          </ThemedText>
                          <ThemedText variant="bodySm" tone="muted" numberOfLines={1}>
                            {tx.groupName} · {tx.kind}
                          </ThemedText>
                          <ThemedText variant="caption" tone="faint">
                            {formatTxDate(tx.occurredAt)}
                          </ThemedText>
                        </View>
                        <ThemedText
                          variant="amountSm"
                          tone={tx.amountMinor > 0 ? "receive" : tx.amountMinor < 0 ? "owe" : "muted"}
                          align="right"
                          style={{ fontWeight: "600", color: tx.amountMinor >= 0 ? "#10B981" : theme.colors.owe }}
                        >
                          {formatSignedMoney(tx.amountMinor, tx.currencyCode)}
                        </ThemedText>
                        <CaretRight size={16} color="#10B981" weight="bold" />
                      </Pressable>
                    );
                  })}
                </View>
                {transactions.length > TRANSACTIONS_PREVIEW ? (
                  <Pressable
                    onPress={() => setShowAllTransactions((value) => !value)}
                    style={[
                      styles.viewAllPill,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.hairline
                      }
                    ]}
                  >
                    <ThemedText variant="bodySm" tone="confirmed" style={{ fontWeight: "600" }}>
                      {showAllTransactions ? "Show fewer transactions" : `See all (${transactions.length})`}
                    </ThemedText>
                    <CaretDown size={14} color="#10B981" weight="bold" />
                  </Pressable>
                ) : null}
              </>
            ) : (
              <EmptyState
                title="No transactions yet"
                body="Shared expenses and settlements with this friend will show here."
              />
            )}
          </View>

          <ActionSheet
            visible={menuOpen}
            title={friend.displayName}
            message="Remind, settle, or jump into a shared group."
            onClose={() => setMenuOpen(false)}
            actions={[
              {
                key: "settle",
                label: "Settle",
                subtitle: "Open settlement for a shared group",
                icon: <Handshake size={20} color={theme.colors.confirmed} weight="duotone" />,
                tone: "confirmed",
                onPress: openSettle
              },
              ...(friend.netMinor > 0
                ? [
                    {
                      key: "remind",
                      label: "Send reminder",
                      subtitle: remind.isPending ? "Sending…" : "Notify them about the balance",
                      icon: <BellRinging size={20} color={theme.colors.info} weight="duotone" />,
                      disabled: remind.isPending,
                      onPress: () => remind.mutate()
                    }
                  ]
                : []),
              ...(friend.sharedGroups[0]
                ? [
                    {
                      key: "group",
                      label: "Open shared group",
                      subtitle: friend.sharedGroups[0].groupName,
                      onPress: () => openGroup(friend.sharedGroups[0].groupId)
                    }
                  ]
                : [])
            ]}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4
  },
  navIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 2,
    marginBottom: 12
  },
  profileMeta: {
    flex: 1,
    gap: 2
  },
  profileName: {
    fontSize: 22,
    fontWeight: "700"
  },
  profileSubtitle: {
    marginBottom: 6
  },
  profileActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5
  },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16
  },
  heroCopy: {
    flex: 1,
    gap: 4
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: "500"
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5
  },
  heroSubtext: {
    fontSize: 13,
    fontWeight: "500"
  },
  heroGraphic: {
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12
  },
  graphicGlow: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center"
  },
  section: {
    gap: 12,
    marginBottom: 16
  },
  stack: {
    gap: 10
  },
  listCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14
  },
  groupIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  txIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  cardCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  viewAllPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 4
  }
});
