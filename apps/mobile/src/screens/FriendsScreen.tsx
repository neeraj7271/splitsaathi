import React, { useMemo, useState } from "react";
import { Pressable, Share, StyleSheet, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { MagnifyingGlass, SlidersHorizontal, UserPlus } from "phosphor-react-native";

import { apiClient } from "../api/client";
import { ActionSheet } from "../components/ActionSheet";
import { Button } from "../components/Button";
import { DataSurface } from "../components/DataSurface";
import { EmptyState } from "../components/EmptyState";
import { FriendSummaryCard } from "../components/FriendSummaryCard";
import { InlineNotice } from "../components/InlineNotice";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { SegmentedControl } from "../components/SegmentedControl";
import { ThemedText } from "../components/ThemedText";
import { colorWithAlpha, useTheme } from "../theme";
import type { FriendSummary } from "../types/domain";
import { AppNavigation } from "../types/navigation";

type FriendFilter = "all" | "outstanding" | "you_owe" | "owes_you";

const FILTERS: Array<{ label: string; value: FriendFilter }> = [
  { label: "All", value: "all" },
  { label: "Outstanding", value: "outstanding" },
  { label: "You owe", value: "you_owe" },
  { label: "Owes you", value: "owes_you" }
];

const SECTION_PREVIEW = 3;
const INVITE_MESSAGE =
  "Join me on SplitSaathi — split expenses with friends without the awkwardness. https://play.google.com/store/apps/details?id=in.splitsaathi.mobile";

function matchesFilter(friend: FriendSummary, filter: FriendFilter): boolean {
  if (filter === "all" || filter === "outstanding") {
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
  const [filter, setFilter] = useState<FriendFilter>("all");
  const [search, setSearch] = useState("");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [expandedSettled, setExpandedSettled] = useState(false);
  const friendsQuery = useQuery({ queryKey: ["friends"], queryFn: () => apiClient.listFriends() });
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filter friends"
          onPress={() => setFilterSheetOpen(true)}
          style={[
            styles.filterBtn,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.hairline,
              borderRadius: theme.radius.md
            }
          ]}
        >
          <SlidersHorizontal size={18} color={theme.colors.inkMuted} weight="duotone" />
        </Pressable>
      </View>

      <SegmentedControl value={filter} options={FILTERS} onChange={setFilter} />

      {friendsQuery.error ? <InlineNotice title="Friends could not load" body={friendsQuery.error.message} tone="owe" /> : null}

      {hasAny ? (
        showGrouped ? (
          <View style={styles.sections}>
            {youOwe.length ? (
              <FriendSection
                title="You owe"
                friends={youOwe}
                previewCount={SECTION_PREVIEW}
                onViewAll={() => setFilter("you_owe")}
                onOpen={openFriend}
              />
            ) : null}
            {owesYou.length ? (
              <FriendSection
                title="Owes you"
                friends={owesYou}
                previewCount={SECTION_PREVIEW}
                onViewAll={() => setFilter("owes_you")}
                onOpen={openFriend}
              />
            ) : null}
            {settled.length ? (
              <View style={styles.section}>
                <SectionHeader
                  title="Settled up"
                  action={
                    settled.length > SECTION_PREVIEW ? (
                      <Pressable onPress={() => setExpandedSettled((value) => !value)} hitSlop={8}>
                        <ThemedText variant="bodySm" tone="confirmed">
                          {expandedSettled ? "Show less" : "View all"}
                        </ThemedText>
                      </Pressable>
                    ) : null
                  }
                />
                <View style={styles.stack}>
                  {settledPreview.map((friend) => (
                    <FriendSummaryCard key={friend.otherUserId} friend={friend} onPress={() => openFriend(friend.otherUserId)} />
                  ))}
                </View>
              </View>
            ) : null}
            {noExpenses.length ? (
              <FriendSection
                title="No expenses yet"
                friends={noExpenses}
                previewCount={SECTION_PREVIEW}
                onOpen={openFriend}
              />
            ) : null}
          </View>
        ) : (
          <View style={styles.stack}>
            {filtered.map((friend) => (
              <FriendSummaryCard key={friend.otherUserId} friend={friend} onPress={() => openFriend(friend.otherUserId)} />
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
  previewCount,
  onViewAll,
  onOpen
}: {
  title: string;
  friends: FriendSummary[];
  previewCount: number;
  onViewAll?: () => void;
  onOpen: (friendUserId: string) => void;
}) {
  const preview = friends.slice(0, previewCount);
  const canViewAll = Boolean(onViewAll) && friends.length > previewCount;

  return (
    <View style={styles.section}>
      <SectionHeader
        title={title}
        action={
          canViewAll ? (
            <Pressable onPress={onViewAll} hitSlop={8}>
              <ThemedText variant="bodySm" tone="confirmed">
                View all
              </ThemedText>
            </Pressable>
          ) : null
        }
      />
      <View style={styles.stack}>
        {preview.map((friend) => (
          <FriendSummaryCard key={friend.otherUserId} friend={friend} onPress={() => onOpen(friend.otherUserId)} />
        ))}
      </View>
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
  }
});
