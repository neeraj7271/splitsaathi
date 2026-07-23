import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "phosphor-react-native";

import { apiClient } from "../api/client";
import { useAppDialog } from "../components/AppDialog";
import { Button } from "../components/Button";
import { DataSurface } from "../components/DataSurface";
import { EmptyState } from "../components/EmptyState";
import { InlineNotice } from "../components/InlineNotice";
import { Screen } from "../components/Screen";
import { ThemedText } from "../components/ThemedText";
import { UserAvatar } from "../components/UserAvatar";
import { useTheme } from "../theme";
import { AppNavigation } from "../types/navigation";
import { formatMoney, formatSignedMoney } from "../utils/money";

export function FriendDetailScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const { showDialog } = useAppDialog();
  const queryClient = useQueryClient();
  const friendUserId = navigation.selectedFriendUserId;

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

  return (
    <Screen refreshing={detailQuery.isRefetching} onRefresh={() => void detailQuery.refetch()}>
      <Pressable onPress={() => navigation.go("friends")} style={styles.backRow}>
        <ArrowLeft size={18} color={theme.colors.inkMuted} weight="bold" />
        <ThemedText variant="bodySm" tone="muted">
          Friends
        </ThemedText>
      </Pressable>

      {!friendUserId ? <InlineNotice title="No friend selected" body="Go back and pick a friend." tone="owe" /> : null}
      {detailQuery.error ? <InlineNotice title="Could not load friend" body={detailQuery.error.message} tone="owe" /> : null}

      {friend ? (
        <>
          <DataSurface>
            <View style={styles.hero}>
              <UserAvatar displayName={friend.displayName} avatarUrl={friend.avatarUrl} size={64} />
              <ThemedText variant="title">{friend.displayName}</ThemedText>
              <ThemedText variant="bodySm" tone="muted">
                {friend.sharedGroupCount} shared group{friend.sharedGroupCount === 1 ? "" : "s"}
              </ThemedText>
              <ThemedText
                variant="balanceHero"
                tone={friend.netMinor > 0 ? "receive" : friend.netMinor < 0 ? "owe" : "muted"}
              >
                {friend.netMinor === 0
                  ? formatMoney(0, friend.currencyCode)
                  : formatSignedMoney(friend.netMinor, friend.currencyCode)}
              </ThemedText>
              <ThemedText variant="bodySm" tone="muted">
                {friend.netMinor > 0
                  ? "They owe you overall"
                  : friend.netMinor < 0
                    ? "You owe them overall"
                    : friend.status === "no_expenses"
                      ? "No shared expenses yet"
                      : "Settled up"}
              </ThemedText>
            </View>
          </DataSurface>

          {friend.netMinor > 0 ? (
            <Button
              label="Send reminder"
              onPress={() => remind.mutate()}
              loading={remind.isPending}
              variant="secondary"
            />
          ) : null}

          <View style={styles.section}>
            <ThemedText variant="bodyMedium">Shared groups</ThemedText>
            <DataSurface>
              {friend.sharedGroups.map((group, index) => (
                <Pressable
                  key={group.groupId}
                  onPress={() => {
                    navigation.setSelectedGroupId(group.groupId);
                    navigation.go("groupDetail");
                  }}
                  style={[
                    styles.row,
                    index < friend.sharedGroups.length - 1
                      ? { borderBottomWidth: 1, borderBottomColor: theme.colors.hairline }
                      : null
                  ]}
                >
                  <View style={styles.copy}>
                    <ThemedText variant="bodyMedium">{group.groupName}</ThemedText>
                    <ThemedText variant="bodySm" tone="muted">
                      Tap to open group
                    </ThemedText>
                  </View>
                  <ThemedText
                    variant="amountSm"
                    tone={group.pairNetMinor > 0 ? "receive" : group.pairNetMinor < 0 ? "owe" : "muted"}
                  >
                    {formatSignedMoney(group.pairNetMinor, group.currencyCode)}
                  </ThemedText>
                </Pressable>
              ))}
            </DataSurface>
          </View>

          <View style={styles.section}>
            <ThemedText variant="bodyMedium">Transactions with you</ThemedText>
            {transactions.length ? (
              <DataSurface>
                {transactions.map((tx, index) => (
                  <View
                    key={tx.id}
                    style={[
                      styles.row,
                      index < transactions.length - 1
                        ? { borderBottomWidth: 1, borderBottomColor: theme.colors.hairline }
                        : null
                    ]}
                  >
                    <View style={styles.copy}>
                      <ThemedText variant="bodyMedium">{tx.description}</ThemedText>
                      <ThemedText variant="bodySm" tone="muted">
                        {tx.groupName} · {tx.kind} · {new Date(tx.occurredAt).toLocaleDateString("en-IN")}
                      </ThemedText>
                    </View>
                    <ThemedText
                      variant="amountSm"
                      tone={tx.amountMinor > 0 ? "receive" : tx.amountMinor < 0 ? "owe" : "muted"}
                    >
                      {formatSignedMoney(tx.amountMinor, tx.currencyCode)}
                    </ThemedText>
                  </View>
                ))}
              </DataSurface>
            ) : (
              <EmptyState title="No transactions yet" body="Shared expenses and settlements with this friend will show here." />
            )}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  hero: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 16,
    paddingHorizontal: 12
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
