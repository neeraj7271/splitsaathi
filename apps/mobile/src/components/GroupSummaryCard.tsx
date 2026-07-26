import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { GroupSummary } from "../types/domain";
import { useTheme } from "../theme";
import { formatSignedMoney } from "../utils/money";
import { GroupTypeAvatar, groupTypeAccent } from "./GroupTypeAvatar";
import { StatusPill } from "./StatusPill";
import { ThemedText } from "./ThemedText";

export function GroupSummaryCard({
  group,
  onPress,
  subtitle
}: {
  group: GroupSummary;
  onPress: () => void;
  subtitle?: string;
}) {
  const theme = useTheme();
  const accent = groupTypeAccent(group.groupType);
  const net = group.netBalanceMinor ?? 0;

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
      <GroupTypeAvatar groupType={group.groupType} imageUrl={group.imageUrl} size={44} />
      <View style={styles.meta}>
        <ThemedText variant="bodyMedium" numberOfLines={1}>
          {group.name}
        </ThemedText>
        <ThemedText variant="bodySm" tone="muted" numberOfLines={1}>
          {subtitle ?? `${group.participantCount ?? 0} Members`}
        </ThemedText>
      </View>
      {group.state === "archived" ? <StatusPill state="expired" /> : null}
      <ThemedText variant="amount" tone={net >= 0 ? "receive" : "owe"} align="right">
        {formatSignedMoney(net, group.baseCurrencyCode)}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingRight: 10,
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
    gap: 2,
    minWidth: 0
  }
});
