import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { CaretRight } from "phosphor-react-native";

import { useTheme } from "../theme";
import { GroupSummary } from "../types/domain";
import { formatMoney, formatSignedMoney } from "../utils/money";
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
        const caption = net >= 0 ? "You will get back" : "You owe";
        const amountLabel =
          net === 0 ? formatMoney(0, group.baseCurrencyCode) : (formatSignedMoney(net, group.baseCurrencyCode) ?? "").replace(/^[+-]/, "");

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
              <ThemedText variant="caption" tone="muted" numberOfLines={1}>
                {caption}{" "}
                <ThemedText variant="caption" tone={net >= 0 ? "receive" : "owe"}>
                  {amountLabel}
                </ThemedText>
              </ThemedText>
            </View>
            <CaretRight size={16} color={theme.colors.inkFaint} weight="bold" />
          </Pressable>
        );
      })}
    </ScrollView>
  );
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
  }
});
