import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { UsersThree } from "phosphor-react-native";

import { apiClient } from "../api/client";
import { DataSurface } from "../components/DataSurface";
import { EmptyState } from "../components/EmptyState";
import { InlineNotice } from "../components/InlineNotice";
import { Screen } from "../components/Screen";
import { SegmentedControl } from "../components/SegmentedControl";
import { ThemedText } from "../components/ThemedText";
import { UserAvatar } from "../components/UserAvatar";
import { useTheme } from "../theme";
import type { FriendBalanceStatus, FriendSummary } from "../types/domain";
import { AppNavigation } from "../types/navigation";
import { formatMoney, formatSignedMoney } from "../utils/money";

type FriendFilter = "all" | "outstanding" | "you_owe" | "owes_you";

const FILTERS: Array<{ label: string; value: FriendFilter }> = [
  { label: "All", value: "all" },
  { label: "Outstanding", value: "outstanding" },
  { label: "You owe", value: "you_owe" },
  { label: "Owes you", value: "owes_you" }
];

function statusLabel(status: FriendBalanceStatus): string {
  switch (status) {
    case "owes_you":
      return "Owes you";
    case "you_owe":
      return "You owe";
    case "settled":
      return "Settled up";
    default:
      return "No expenses";
  }
}

function matchesFilter(friend: FriendSummary, filter: FriendFilter): boolean {
  if (filter === "all") {
    // Outstanding only in the main list; settled / no-expenses have their own sections.
    return friend.netMinor !== 0;
  }
  if (filter === "outstanding") {
    return friend.netMinor !== 0;
  }
  if (filter === "you_owe") {
    return friend.status === "you_owe";
  }
  return friend.status === "owes_you";
}

export function FriendsScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const [filter, setFilter] = useState<FriendFilter>("all");
  const friendsQuery = useQuery({ queryKey: ["friends"], queryFn: () => apiClient.listFriends() });
  const friends = friendsQuery.data ?? [];
  const filtered = useMemo(() => friends.filter((friend) => matchesFilter(friend, filter)), [friends, filter]);
  const settled = useMemo(() => friends.filter((friend) => friend.status === "settled"), [friends]);
  const noExpenses = useMemo(() => friends.filter((friend) => friend.status === "no_expenses"), [friends]);

  return (
    <Screen
      refreshing={friendsQuery.isRefetching}
      onRefresh={() => void friendsQuery.refetch()}
    >
      <View style={styles.header}>
        <View>
          <ThemedText variant="caption" tone="muted">
            Across your groups
          </ThemedText>
          <ThemedText variant="title">Friends</ThemedText>
        </View>
        <UsersThree size={28} color={theme.colors.confirmed} weight="duotone" />
      </View>

      <SegmentedControl value={filter} options={FILTERS} onChange={setFilter} />

      {friendsQuery.error ? <InlineNotice title="Friends could not load" body={friendsQuery.error.message} tone="owe" /> : null}

      {filtered.length ? (
        <DataSurface>
          {filtered.map((friend, index) => (
            <Pressable
              key={friend.otherUserId}
              onPress={() => {
                navigation.setSelectedFriendUserId(friend.otherUserId);
                navigation.go("friendDetail");
              }}
              style={[
                styles.row,
                index < filtered.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.colors.hairline } : null
              ]}
            >
              <UserAvatar displayName={friend.displayName} avatarUrl={friend.avatarUrl} size={44} />
              <View style={styles.copy}>
                <ThemedText variant="bodyMedium">{friend.displayName}</ThemedText>
                <ThemedText variant="bodySm" tone="muted">
                  {statusLabel(friend.status)} · {friend.sharedGroupCount} group
                  {friend.sharedGroupCount === 1 ? "" : "s"}
                </ThemedText>
              </View>
              <ThemedText
                variant="amountSm"
                tone={friend.netMinor > 0 ? "receive" : friend.netMinor < 0 ? "owe" : "muted"}
              >
                {friend.netMinor === 0 ? formatMoney(0, friend.currencyCode) : formatSignedMoney(friend.netMinor, friend.currencyCode)}
              </ThemedText>
            </Pressable>
          ))}
        </DataSurface>
      ) : (
        <EmptyState
          title={friends.length ? "No friends in this filter" : "No friends yet"}
          body={
            friends.length
              ? "Try another filter, or settle up to move people into Settled."
              : "People you share groups with will show up here with balances."
          }
        />
      )}

      {filter === "all" && settled.length ? (
        <View style={styles.section}>
          <ThemedText variant="bodyMedium">Settled up</ThemedText>
          <DataSurface>
            {settled.map((friend, index) => (
              <Pressable
                key={`settled-${friend.otherUserId}`}
                onPress={() => {
                  navigation.setSelectedFriendUserId(friend.otherUserId);
                  navigation.go("friendDetail");
                }}
                style={[
                  styles.row,
                  index < settled.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.colors.hairline } : null
                ]}
              >
                <UserAvatar displayName={friend.displayName} avatarUrl={friend.avatarUrl} size={40} />
                <View style={styles.copy}>
                  <ThemedText variant="bodyMedium">{friend.displayName}</ThemedText>
                  <ThemedText variant="bodySm" tone="muted">
                    Settled up
                  </ThemedText>
                </View>
              </Pressable>
            ))}
          </DataSurface>
        </View>
      ) : null}

      {filter === "all" && noExpenses.length ? (
        <View style={styles.section}>
          <ThemedText variant="bodyMedium">No expenses yet</ThemedText>
          <DataSurface>
            {noExpenses.map((friend, index) => (
              <Pressable
                key={`none-${friend.otherUserId}`}
                onPress={() => {
                  navigation.setSelectedFriendUserId(friend.otherUserId);
                  navigation.go("friendDetail");
                }}
                style={[
                  styles.row,
                  index < noExpenses.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.colors.hairline } : null
                ]}
              >
                <UserAvatar displayName={friend.displayName} avatarUrl={friend.avatarUrl} size={40} />
                <View style={styles.copy}>
                  <ThemedText variant="bodyMedium">{friend.displayName}</ThemedText>
                  <ThemedText variant="bodySm" tone="muted">
                    Shared groups, no shared expenses yet
                  </ThemedText>
                </View>
              </Pressable>
            ))}
          </DataSurface>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  section: {
    gap: 8
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8
  },
  copy: {
    flex: 1,
    gap: 2
  }
});
