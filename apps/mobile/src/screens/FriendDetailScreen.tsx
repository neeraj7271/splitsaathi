import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CaretDown,
  CaretRight,
  DotsThreeVertical,
  Handshake,
  BellRinging
} from "phosphor-react-native";

import { apiClient } from "../api/client";
import { ActionSheet } from "../components/ActionSheet";
import { useAppDialog } from "../components/AppDialog";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { friendAccent } from "../components/FriendSummaryCard";
import { GroupTypeAvatar } from "../components/GroupTypeAvatar";
import { InlineNotice } from "../components/InlineNotice";
import { Screen } from "../components/Screen";
import { ScreenBackButton } from "../components/ScreenBackButton";
import { ThemedText } from "../components/ThemedText";
import { UserAvatar } from "../components/UserAvatar";
import { colorWithAlpha, useTheme } from "../theme";
import type { FriendSharedGroup, FriendSummary, FriendTransaction } from "../types/domain";
import { AppNavigation } from "../types/navigation";
import { formatMoney, formatSignedMoney } from "../utils/money";

const GROUPS_PREVIEW = 3;
const TRANSACTIONS_PREVIEW = 5;

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
      <View style={styles.topBar}>
        <ScreenBackButton navigation={navigation} label="Back" fallbackRoute="friends" />
        <Pressable
          onPress={() => setMenuOpen(true)}
          style={[styles.navIconButton, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.hairline }]}
          accessibilityRole="button"
          accessibilityLabel="Friend options"
        >
          <DotsThreeVertical size={18} color={theme.colors.ink} weight="bold" />
        </Pressable>
      </View>

      {!friendUserId ? <InlineNotice title="No friend selected" body="Go back and pick a friend." tone="owe" /> : null}
      {detailQuery.error ? <InlineNotice title="Could not load friend" body={detailQuery.error.message} tone="owe" /> : null}

      {friend ? (
        <>
          <View style={styles.profileRow}>
            <UserAvatar
              displayName={friend.displayName}
              avatarUrl={friend.avatarUrl}
              size={64}
              accentColor={accent}
            />
            <View style={styles.profileCopy}>
              <ThemedText variant="title" numberOfLines={1}>
                {friend.displayName}
              </ThemedText>
              <ThemedText variant="bodySm" tone="muted">
                {friend.sharedGroupCount} shared group{friend.sharedGroupCount === 1 ? "" : "s"}
              </ThemedText>
            </View>
            <Button
              label="Settle up"
              variant="secondary"
              tone="confirmed"
              size="compact"
              Icon={Handshake}
              onPress={openSettle}
              style={styles.settleButton}
            />
          </View>

          <View
            style={[
              styles.balanceCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.hairline,
                borderRadius: theme.radius.md,
                borderWidth: theme.mode === "light" ? 0 : 1
              },
              theme.cardShadow
            ]}
          >
            <ThemedText variant="bodySm" tone="muted" align="center">
              {balanceHeadline(friend)}
            </ThemedText>
            <ThemedText
              variant="balanceHero"
              tone={friend.netMinor > 0 ? "receive" : friend.netMinor < 0 ? "owe" : "confirmed"}
              align="center"
            >
              {friend.netMinor === 0
                ? formatMoney(0, friend.currencyCode)
                : formatSignedMoney(friend.netMinor, friend.currencyCode)}
            </ThemedText>
            <ThemedText variant="caption" tone="muted" align="center">
              {balanceSubcopy(friend)}
            </ThemedText>
          </View>

          <View style={styles.section}>
            <ThemedText variant="bodyMedium">Shared groups</ThemedText>
            {friend.sharedGroups.length ? (
              <>
                <View style={styles.stack}>
                  {visibleGroups.map((group) => (
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
                      <GroupTypeAvatar groupType={group.groupType} imageUrl={group.imageUrl} size={44} />
                      <View style={styles.cardCopy}>
                        <ThemedText variant="bodyMedium" numberOfLines={1}>
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
                      >
                        {group.pairNetMinor === 0
                          ? formatMoney(0, group.currencyCode)
                          : formatSignedMoney(group.pairNetMinor, group.currencyCode)}
                      </ThemedText>
                      <CaretRight size={16} color={theme.colors.confirmed} weight="bold" />
                    </Pressable>
                  ))}
                </View>
                {friend.sharedGroups.length > GROUPS_PREVIEW ? (
                  <Pressable
                    onPress={() => setShowAllGroups((value) => !value)}
                    style={[
                      styles.viewAll,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.hairline,
                        borderRadius: theme.radius.full
                      }
                    ]}
                  >
                    <ThemedText variant="bodySm" tone="confirmed">
                      {showAllGroups
                        ? "Show fewer groups"
                        : `View all groups (${friend.sharedGroups.length})`}
                    </ThemedText>
                    <CaretDown size={14} color={theme.colors.confirmed} weight="bold" />
                  </Pressable>
                ) : null}
              </>
            ) : (
              <EmptyState title="No shared groups" body="You don’t share any groups with this friend yet." />
            )}
          </View>

          <View style={styles.section}>
            <ThemedText variant="bodyMedium">Transactions with you</ThemedText>
            {transactions.length ? (
              <>
                <View style={styles.stack}>
                  {visibleTransactions.map((tx) => {
                    const incoming = tx.amountMinor > 0;
                    const iconColor = incoming ? theme.colors.receive : theme.colors.owe;
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
                          <ThemedText variant="bodyMedium" numberOfLines={1}>
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
                        >
                          {formatSignedMoney(tx.amountMinor, tx.currencyCode)}
                        </ThemedText>
                        <CaretRight size={16} color={theme.colors.confirmed} weight="bold" />
                      </Pressable>
                    );
                  })}
                </View>
                {transactions.length > TRANSACTIONS_PREVIEW ? (
                  <Pressable
                    onPress={() => setShowAllTransactions((value) => !value)}
                    style={[
                      styles.viewAll,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.hairline,
                        borderRadius: theme.radius.full
                      }
                    ]}
                  >
                    <ThemedText variant="bodySm" tone="confirmed">
                      {showAllTransactions ? "Show fewer transactions" : "View all transactions"}
                    </ThemedText>
                    <CaretDown size={14} color={theme.colors.confirmed} weight="bold" />
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
                label: "Settle up",
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
    justifyContent: "space-between"
  },
  navIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  profileCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0
  },
  settleButton: {
    flexShrink: 0
  },
  balanceCard: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 18,
    paddingHorizontal: 16
  },
  section: {
    gap: 10
  },
  stack: {
    gap: 10
  },
  listCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12
  },
  cardCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  txIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  viewAll: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 14
  }
});
