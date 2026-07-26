import React from "react";
import { StyleSheet, View } from "react-native";
import {
  ArrowDown,
  CalendarBlank,
  ShoppingBag,
  Wallet
} from "phosphor-react-native";

import { formatActivityTitle, humanizeEventType } from "../utils/displayNames";
import { colorWithAlpha, useTheme } from "../theme";
import { ActivityRowDto, SettlementState } from "../types/domain";
import { formatSignedMoney } from "../utils/money";
import { StatusPill } from "./StatusPill";
import { ThemedText } from "./ThemedText";
import { UserAvatar } from "./UserAvatar";

export function ActivityRow({
  item,
  groupName,
  groupImageUrl
}: {
  item: ActivityRowDto;
  groupName?: string;
  groupImageUrl?: string | null;
}) {
  const theme = useTheme();
  const amount = item.amountMinor ?? 0;
  const amountTone = amount >= 0 ? "receive" : "owe";
  const avatarLabel = groupName?.trim() || formatActivityTitle(item.title);
  const meta = activityVisual(item, theme.colors.confirmed, theme.colors.info, theme.colors.pending);
  const Icon = meta.Icon;
  const when = formatActivityWhen(item.occurredAt);

  return (
    <View
      style={[
        styles.row,
        {
          borderBottomColor: theme.colors.hairline,
          paddingVertical: theme.spacing.rowVertical,
          paddingHorizontal: 14
        }
      ]}
    >
      <View style={styles.avatarWrap}>
        <UserAvatar displayName={avatarLabel} avatarUrl={groupImageUrl} size={44} />
        <View
          style={[
            styles.typeBadge,
            {
              backgroundColor: colorWithAlpha(meta.color, theme.mode === "dark" ? 0.28 : 0.16),
              borderColor: theme.colors.surface
            }
          ]}
        >
          <Icon size={11} color={meta.color} weight="fill" />
        </View>
      </View>
      <View style={styles.middle}>
        <ThemedText variant="bodyMedium" numberOfLines={1}>
          {formatActivityTitle(item.title)}
        </ThemedText>
        <ThemedText variant="bodySm" tone="muted" numberOfLines={2}>
          {item.body || humanizeEventType(item.activityType)}
        </ThemedText>
        {when ? (
          <View style={styles.whenRow}>
            <CalendarBlank size={12} color={theme.colors.inkFaint} weight="duotone" />
            <ThemedText variant="caption" tone="faint">
              {when}
            </ThemedText>
          </View>
        ) : null}
      </View>
      <View style={styles.trailing}>
        {typeof item.amountMinor === "number" ? (
          <ThemedText variant="amountSm" tone={amountTone} align="right">
            {formatSignedMoney(item.amountMinor, item.currencyCode)}
          </ThemedText>
        ) : null}
        {item.status && isSettlementStatus(item.status) ? (
          <StatusPill state={item.status} />
        ) : amount < 0 ? (
          <View style={[styles.softPill, { backgroundColor: colorWithAlpha(theme.colors.owe, theme.mode === "dark" ? 0.22 : 0.12) }]}>
            <ThemedText variant="caption" tone="owe">
              Paid
            </ThemedText>
          </View>
        ) : amount > 0 ? (
          <View
            style={[
              styles.softPill,
              { backgroundColor: colorWithAlpha(theme.colors.confirmed, theme.mode === "dark" ? 0.22 : 0.12) }
            ]}
          >
            <ThemedText variant="caption" tone="confirmed">
              Posted
            </ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function activityVisual(
  item: ActivityRowDto,
  confirmed: string,
  info: string,
  pending: string
) {
  const type = item.activityType.toLowerCase();
  const title = `${item.title} ${item.body ?? ""}`.toLowerCase();
  if (type.includes("settlement") || type.includes("payment") || title.includes("payment") || title.includes("paid")) {
    return { color: confirmed, Icon: ArrowDown };
  }
  if (title.includes("grocer") || title.includes("shop") || title.includes("market")) {
    return { color: pending, Icon: ShoppingBag };
  }
  return { color: info, Icon: Wallet };
}

function formatActivityWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startThat = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startToday - startThat) / 86400000);
  const day =
    diffDays === 0 ? "Today" : diffDays === 1 ? "Yesterday" : date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const time = date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return `${day}, ${time}`;
}

const styles = StyleSheet.create({
  row: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1
  },
  avatarWrap: {
    width: 44,
    height: 44
  },
  typeBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center"
  },
  middle: {
    flex: 1,
    gap: 3,
    minWidth: 0
  },
  whenRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2
  },
  trailing: {
    alignItems: "flex-end",
    gap: 6,
    maxWidth: 128
  },
  softPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3
  }
});

function isSettlementStatus(status: NonNullable<ActivityRowDto["status"]>): status is SettlementState {
  return [
    "suggested",
    "intent_created",
    "intent_generated",
    "payer_opened_upi_app",
    "awaiting_payment_evidence",
    "proof_submitted",
    "auto_matched",
    "awaiting_receiver_confirmation",
    "confirmed",
    "ledger_posted",
    "expired",
    "cancelled",
    "disputed",
    "rejected",
    "partial_detected",
    "duplicate_reference_review",
    "reversed",
    "refunded"
  ].includes(status as SettlementState);
}
