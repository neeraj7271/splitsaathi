import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { CaretRight, UsersThree } from "phosphor-react-native";

import { colorWithAlpha, useTheme } from "../theme";
import type { FriendSummary } from "../types/domain";
import { formatMoney, formatSignedMoney } from "../utils/money";
import { participantColor } from "../utils/participantColor";
import { ThemedText } from "./ThemedText";
import { UserAvatar } from "./UserAvatar";

export function friendAccent(friend: FriendSummary, colors: { owe: string; receive: string }) {
  if (friend.status === "you_owe") {
    return colors.owe;
  }
  if (friend.status === "owes_you") {
    return colors.receive;
  }
  return participantColor(friend.otherUserId);
}

export function friendStatusLabel(friend: FriendSummary) {
  switch (friend.status) {
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

export function FriendSummaryCard({
  friend,
  onPress,
  onRemind,
  isReminding = false,
  isReminded = false
}: {
  friend: FriendSummary;
  onPress: () => void;
  onRemind?: () => void;
  isReminding?: boolean;
  isReminded?: boolean;
}) {
  const theme = useTheme();
  const accent = friendAccent(friend, theme.colors);
  const settled = friend.netMinor === 0;
  const groupLabel = `${friend.sharedGroupCount} group${friend.sharedGroupCount === 1 ? "" : "s"}`;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.hairline,
          borderRadius: theme.radius.md,
          borderWidth: theme.mode === "light" ? 0 : 1
        },
        theme.cardShadow
      ]}
    >
      <View style={[styles.accentStrip, { backgroundColor: accent }]} />
      <UserAvatar displayName={friend.displayName} avatarUrl={friend.avatarUrl} size={44} accentColor={accent} />
      <View style={styles.meta}>
        <ThemedText variant="bodyMedium" numberOfLines={1}>
          {friend.displayName}
        </ThemedText>
        <View style={styles.metaRow}>
          <ThemedText variant="bodySm" tone="muted" numberOfLines={1}>
            {friendStatusLabel(friend)}
          </ThemedText>
          <View style={styles.groupChip}>
            <UsersThree size={12} color={theme.colors.inkFaint} weight="duotone" />
            <ThemedText variant="caption" tone="faint" numberOfLines={1}>
              {groupLabel}
            </ThemedText>
          </View>
        </View>
      </View>

      {settled ? (
        <View
          style={[
            styles.settledPill,
            {
              backgroundColor: colorWithAlpha(theme.colors.confirmed, theme.mode === "dark" ? 0.16 : 0.1),
              borderRadius: theme.radius.full
            }
          ]}
        >
          <ThemedText variant="caption" tone="confirmed">
            Settled
          </ThemedText>
        </View>
      ) : (
        <View style={styles.amountCol}>
          <ThemedText variant="amountSm" tone={friend.netMinor > 0 ? "receive" : "owe"} align="right">
            {friend.netMinor === 0
              ? formatMoney(0, friend.currencyCode)
              : formatSignedMoney(friend.netMinor, friend.currencyCode)}
          </ThemedText>
          {onRemind && friend.status === "owes_you" ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onRemind();
              }}
              disabled={isReminding || isReminded}
              style={[
                styles.remindBtn,
                {
                  backgroundColor: isReminded
                    ? colorWithAlpha(theme.colors.confirmed, 0.15)
                    : colorWithAlpha(theme.colors.info, theme.mode === "dark" ? 0.2 : 0.12),
                  borderColor: isReminded ? theme.colors.confirmed : theme.colors.info
                }
              ]}
            >
              <ThemedText variant="caption" tone={isReminded ? "confirmed" : "info"}>
                {isReminded ? "Reminded" : isReminding ? "Sending..." : "Remind"}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      )}
      <CaretRight size={16} color={theme.colors.confirmed} weight="bold" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingRight: 12,
    paddingLeft: 0,
    overflow: "hidden"
  },
  accentStrip: {
    width: 3,
    alignSelf: "stretch",
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    marginRight: 8
  },
  meta: {
    flex: 1,
    gap: 4,
    minWidth: 0
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap"
  },
  groupChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  settledPill: {
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  amountCol: {
    alignItems: "flex-end",
    gap: 4
  },
  remindBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1
  }
});
