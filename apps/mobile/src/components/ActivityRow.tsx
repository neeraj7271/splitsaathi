import React from "react";
import { StyleSheet, View } from "react-native";

import { formatActivityTitle, humanizeEventType } from "../utils/displayNames";
import { useTheme } from "../theme";
import { ActivityRowDto, SettlementState } from "../types/domain";
import { formatSignedMoney } from "../utils/money";
import { StatusPill } from "./StatusPill";
import { ThemedText } from "./ThemedText";

export function ActivityRow({ item }: { item: ActivityRowDto }) {
  const theme = useTheme();
  const amountTone = (item.amountMinor ?? 0) >= 0 ? "receive" : "owe";

  return (
    <View style={[styles.row, { borderBottomColor: theme.colors.hairline, paddingVertical: theme.spacing.rowVertical }]}>
      <View style={[styles.avatar, { backgroundColor: theme.colors.surfaceRaised }]}>
        <ThemedText variant="caption">{formatActivityTitle(item.title).slice(0, 1).toUpperCase()}</ThemedText>
      </View>
      <View style={styles.middle}>
        <ThemedText variant="bodyMedium">{formatActivityTitle(item.title)}</ThemedText>
        <ThemedText variant="bodySm" tone="muted" numberOfLines={2}>
          {item.body || humanizeEventType(item.activityType)}
        </ThemedText>
      </View>
      <View style={styles.trailing}>
        {typeof item.amountMinor === "number" ? (
          <ThemedText variant="amount" tone={amountTone} align="right">
            {formatSignedMoney(item.amountMinor, item.currencyCode)}
          </ThemedText>
        ) : null}
        {item.status && isSettlementStatus(item.status) ? <StatusPill state={item.status} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  middle: {
    flex: 1,
    gap: 4
  },
  trailing: {
    alignItems: "flex-end",
    gap: 6,
    maxWidth: 128
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
