import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { CaretRight } from "phosphor-react-native";

import { useTheme } from "../theme";
import { GroupSummary } from "../types/domain";
import { formatMoney } from "../utils/money";
import { groupTypeAccent, groupTypeIcon } from "./GroupTypeAvatar";
import { StatusPill } from "./StatusPill";
import { ThemedText } from "./ThemedText";
import { UserAvatar } from "./UserAvatar";

export function GroupSelector({
  groups,
  selectedGroupId,
  onSelect
}: {
  groups: GroupSummary[];
  selectedGroupId?: string;
  onSelect: (groupId: string) => void;
}) {
  const theme = useTheme();

  if (groups.length === 0) {
    return null;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      {groups.map((group) => {
        const selected = group.id === selectedGroupId;
        const accent = groupTypeAccent(group.groupType);
        const Icon = groupTypeIcon(group.groupType);
        const net = group.netBalanceMinor ?? 0;
        const balance = groupBalanceCaption(net, group.baseCurrencyCode);

        return (
          <Pressable
            key={group.id}
            onPress={() => onSelect(group.id)}
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: selected ? accent : theme.colors.hairline,
                borderRadius: theme.radius.md,
                borderWidth: selected ? 1.5 : 1
              },
              selected ? theme.cardShadow : null
            ]}
          >
            {group.imageUrl ? (
              <UserAvatar displayName={group.name} avatarUrl={group.imageUrl} size={40} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: accent }]}>
                <Icon size={18} color="#FFFFFF" weight="fill" />
              </View>
            )}
            <View style={styles.copy}>
              <View style={styles.nameRow}>
                <ThemedText variant="bodyMedium" numberOfLines={1} style={styles.name}>
                  {group.name}
                </ThemedText>
                {group.pendingProofCount ? <StatusPill state="proof_submitted" /> : null}
              </View>
              <View style={styles.balanceRow}>
                <ThemedText variant="caption" tone={balance.labelTone} numberOfLines={1}>
                  {balance.label}
                </ThemedText>
                {balance.amount ? (
                  <ThemedText variant="caption" tone={balance.amountTone} numberOfLines={1}>
                    {balance.amount}
                  </ThemedText>
                ) : null}
              </View>
            </View>
            <CaretRight size={16} color={theme.colors.inkFaint} weight="bold" />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function groupBalanceCaption(
  netMinor: number,
  currencyCode: string
): {
  label: string;
  amount: string | null;
  labelTone: "muted" | "receive" | "owe";
  amountTone: "receive" | "owe";
} {
  if (netMinor === 0) {
    return { label: "Settled up", amount: null, labelTone: "muted", amountTone: "receive" };
  }
  if (netMinor > 0) {
    return {
      label: "Owed to you",
      amount: formatMoney(netMinor, currencyCode),
      labelTone: "muted",
      amountTone: "receive"
    };
  }
  return {
    label: "You owe",
    amount: formatMoney(Math.abs(netMinor), currencyCode),
    labelTone: "muted",
    amountTone: "owe"
  };
}

const styles = StyleSheet.create({
  scroll: {
    gap: 10,
    paddingRight: 8
  },
  card: {
    width: 210,
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center"
  },
  copy: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  name: {
    flexShrink: 1
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap"
  }
});
