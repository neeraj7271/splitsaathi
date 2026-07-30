import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, TextInput, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, CaretDown, Clock, MagnifyingGlass, SquaresFour, UserPlus } from "phosphor-react-native";

import { apiClient } from "../api/client";
import { useAppDialog } from "../components/AppDialog";
import { ActionSheet } from "../components/ActionSheet";
import { Button } from "../components/Button";
import { DataSurface } from "../components/DataSurface";
import { EmptyState } from "../components/EmptyState";
import { FriendSummaryCard } from "../components/FriendSummaryCard";
import { InlineNotice } from "../components/InlineNotice";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { ThemedText } from "../components/ThemedText";
import { colorWithAlpha, useTheme } from "../theme";
import type { FriendSummary } from "../types/domain";
import { AppNavigation } from "../types/navigation";

type FriendFilter = "all" | "outstanding" | "you_owe" | "owes_you";

const FILTERS: Array<{
  label: string;
  value: FriendFilter;
  Icon: typeof SquaresFour;
  accent: "confirmed" | "pending" | "info" | "receive";
}> = [
  { label: "All", value: "all", Icon: SquaresFour, accent: "confirmed" },
  { label: "Outstanding", value: "outstanding", Icon: Clock, accent: "pending" },
  { label: "You owe", value: "you_owe", Icon: ArrowUpRight, accent: "info" },
  { label: "Owes you", value: "owes_you", Icon: ArrowDownLeft, accent: "receive" }
];

const SECTION_PREVIEW = 100;
const INVITE_MESSAGE =
  "Join me on SplitSaathi — split expenses with friends without the awkwardness. https://play.google.com/store/apps/details?id=in.splitsaathi.mobile";

function matchesFilter(friend: FriendSummary, filter: FriendFilter): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "outstanding") {
    return friend.netMinor !== 0;
  }
  if (filter === "you_owe") {
    return friend.status === "you_owe";
  }
  return friend.status === "owes_you";
}

function matchesSearch(friend: FriendSummary, query: string) {
  if (!query) {
    return true;
  }
  return friend.displayName.toLowerCase().includes(query);
}

async function shareInvite() {
  await Share.share({ message: INVITE_MESSAGE });
}

export function FriendsScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const { showDialog } = useAppDialog();
  const [filter, setFilter] = useState<FriendFilter>("all");
  const [search, setSearch] = useState("");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [expandedSettled, setExpandedSettled] = useState(false);
  const [remindedUserIds, setRemindedUserIds] = useState<Record<string, boolean>>({});

  const friendsQuery = useQuery({ queryKey: ["friends"], queryFn: () => apiClient.listFriends() });
  const remindMutation = useMutation({
    mutationFn: (targetUserId: string) => apiClient.remindFriend(targetUserId),
    onSuccess: (_, targetUserId) => {
      setRemindedUserIds((prev) => ({ ...prev, [targetUserId]: true }));
      showDialog({
        title: "Reminder Sent",
        message: "A payment reminder notification has been delivered.",
        tone: "success",
        primaryAction: { label: "OK" }
      });
    },
    onError: (err: Error) => {
      showDialog({
        title: "Could not send reminder",
        message: err.message,
        tone: "error",
        primaryAction: { label: "OK" }
      });
    }
  });

  const friends = friendsQuery.data ?? [];
  const query = search.trim().toLowerCase();

  const searched = useMemo(() => friends.filter((friend) => matchesSearch(friend, query)), [friends, query]);
  const youOwe = useMemo(() => searched.filter((friend) => friend.status === "you_owe"), [searched]);
  const owesYou = useMemo(() => searched.filter((friend) => friend.status === "owes_you"), [searched]);
  const settled = useMemo(() => searched.filter((friend) => friend.status === "settled"), [searched]);
  const noExpenses = useMemo(() => searched.filter((friend) => friend.status === "no_expenses"), [searched]);
  const filtered = useMemo(() => searched.filter((friend) => matchesFilter(friend, filter)), [searched, filter]);

  function openFriend(friendUserId: string) {
    navigation.setSelectedFriendUserId(friendUserId);
    navigation.go("friendDetail");
  }

  const showGrouped = filter === "all";
  const settledPreview = expandedSettled ? settled : settled.slice(0, SECTION_PREVIEW);
  const hasAny =
    showGrouped
      ? youOwe.length + owesYou.length + settled.length + noExpenses.length > 0
      : filtered.length > 0;

  return (
    <Screen refreshing={friendsQuery.isRefetching} onRefresh={() => void friendsQuery.refetch()}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <ThemedText variant="caption" tone="muted">
            Across your groups
          </ThemedText>
          <ThemedText variant="title">Friends</ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Invite friends"
          onPress={() => void shareInvite()}
          hitSlop={8}
          style={[
            styles.headerAction,
            {
              backgroundColor: colorWithAlpha(theme.colors.confirmed, theme.mode === "dark" ? 0.16 : 0.1),
              borderColor: colorWithAlpha(theme.colors.confirmed, 0.28),
              borderRadius: theme.radius.full
            }
          ]}
        >
          <UserPlus size={20} color={theme.colors.confirmed} weight="duotone" />
        </Pressable>
      </View>

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
            placeholder="Search friends"
            placeholderTextColor={theme.colors.inkFaint}
            style={[theme.typography.body, styles.searchInput, { color: theme.colors.ink }]}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>

      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((option) => {
          const active = option.value === filter;
          const accent = theme.colors[option.accent];
          const Icon = option.Icon;
          return (
            <Pressable
              key={option.value}
              onPress={() => setFilter(option.value)}
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

      {friendsQuery.error ? <InlineNotice title="Friends could not load" body={friendsQuery.error.message} tone="owe" /> : null}

      {hasAny ? (
        showGrouped ? (
          <View style={styles.sections}>
            {youOwe.length ? (
              <FriendSection
                title="You owe"
                friends={youOwe}
                onOpen={openFriend}
              />
            ) : null}
            {owesYou.length ? (
              <FriendSection
                title="Owes you"
                friends={owesYou}
                onOpen={openFriend}
                onRemind={(friendUserId) => remindMutation.mutate(friendUserId)}
                remindingUserId={remindMutation.isPending ? remindMutation.variables : undefined}
                remindedUserIds={remindedUserIds}
              />
            ) : null}
            {settled.length ? (
              <FriendSection
                title="Settled up"
                friends={settled}
                onOpen={openFriend}
              />
            ) : null}
            {noExpenses.length ? (
              <FriendSection
                title="No expenses yet"
                friends={noExpenses}
                onOpen={openFriend}
              />
            ) : null}
          </View>
        ) : (
          <View style={styles.stack}>
            {filtered.map((friend) => (
              <FriendSummaryCard
                key={friend.otherUserId}
                friend={friend}
                onPress={() => openFriend(friend.otherUserId)}
                onRemind={() => remindMutation.mutate(friend.otherUserId)}
                isReminding={remindMutation.isPending && remindMutation.variables === friend.otherUserId}
                isReminded={Boolean(remindedUserIds[friend.otherUserId])}
              />
            ))}
          </View>
        )
      ) : (
        <EmptyState
          title={friends.length ? "No friends match" : "No friends yet"}
          body={
            friends.length
              ? "Try another filter or search, or settle up to move people into Settled."
              : "People you share groups with will show up here with balances."
          }
        />
      )}

      <DataSurface elevated>
        <View style={styles.inviteCard}>
          <View
            style={[
              styles.inviteIcon,
              {
                backgroundColor: colorWithAlpha(theme.colors.confirmed, theme.mode === "dark" ? 0.18 : 0.12),
                borderRadius: theme.radius.md
              }
            ]}
          >
            <UserPlus size={22} color={theme.colors.confirmed} weight="duotone" />
          </View>
          <View style={styles.inviteCopy}>
            <ThemedText variant="bodyMedium">Share SplitSaathi</ThemedText>
            <ThemedText variant="bodySm" tone="muted">
              Invite friends and start splitting expenses together.
            </ThemedText>
          </View>
          <Button label="Invite friends" variant="secondary" tone="confirmed" size="compact" onPress={() => void shareInvite()} />
        </View>
      </DataSurface>

      <ActionSheet
        visible={filterSheetOpen}
        title="Filter friends"
        message="Show balances by status across your shared groups."
        onClose={() => setFilterSheetOpen(false)}
        actions={FILTERS.map((option) => ({
          key: option.value,
          label: option.label,
          tone: option.value === filter ? "confirmed" : "default",
          onPress: () => setFilter(option.value)
        }))}
      />
    </Screen>
  );
}

function FriendSection({
  title,
  friends,
  onOpen,
  onRemind,
  remindingUserId,
  remindedUserIds = {}
}: {
  title: string;
  friends: FriendSummary[];
  onOpen: (friendUserId: string) => void;
  onRemind?: (friendUserId: string) => void;
  remindingUserId?: string;
  remindedUserIds?: Record<string, boolean>;
}) {
  const theme = useTheme();
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 5;
  const visibleFriends = showAll ? friends : friends.slice(0, LIMIT);
  const hasMore = friends.length > LIMIT;

  return (
    <View style={styles.section}>
      <SectionHeader title={title} />
      <View style={styles.stack}>
        {visibleFriends.map((friend) => (
          <FriendSummaryCard
            key={friend.otherUserId}
            friend={friend}
            onPress={() => onOpen(friend.otherUserId)}
            onRemind={onRemind ? () => onRemind(friend.otherUserId) : undefined}
            isReminding={remindingUserId === friend.otherUserId}
            isReminded={Boolean(remindedUserIds[friend.otherUserId])}
          />
        ))}
      </View>
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
            {showAll ? "Show less" : `See all (${friends.length})`}
          </ThemedText>
          <CaretDown size={14} color={theme.colors.info} style={{ transform: [{ rotate: showAll ? "180deg" : "0deg" }] }} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  headerCopy: {
    flex: 1,
    gap: 2
  },
  headerAction: {
    width: 44,
    height: 44,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  searchField: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderWidth: 1
  },
  searchInput: {
    flex: 1,
    padding: 0,
    minHeight: 44
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  sections: {
    gap: 18
  },
  section: {
    gap: 10
  },
  stack: {
    gap: 10
  },
  inviteCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14
  },
  inviteIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  inviteCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  filterRow: {
    gap: 8,
    paddingRight: 8
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1
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
