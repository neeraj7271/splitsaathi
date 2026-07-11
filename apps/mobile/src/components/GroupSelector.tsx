import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { useTheme } from "../theme";
import { GroupSummary } from "../types/domain";
import { formatSignedMoney } from "../utils/money";
import { StatusPill } from "./StatusPill";
import { ThemedText } from "./ThemedText";

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
        return (
          <Pressable
            key={group.id}
            onPress={() => onSelect(group.id)}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? theme.colors.surface : theme.colors.surfaceRaised,
                borderColor: selected ? theme.colors.confirmed : theme.colors.hairline,
                borderRadius: theme.radius.md
              }
            ]}
          >
            <View style={styles.nameRow}>
              <ThemedText variant="bodyMedium">{group.name}</ThemedText>
              {group.pendingProofCount ? <StatusPill state="proof_submitted" /> : null}
            </View>
            <ThemedText variant="amountSm" tone={(group.netBalanceMinor ?? 0) >= 0 ? "receive" : "owe"}>
              {formatSignedMoney(group.netBalanceMinor, group.baseCurrencyCode)}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: 12,
    paddingRight: 20
  },
  chip: {
    width: 176,
    padding: 14,
    gap: 8,
    borderWidth: 1
  },
  nameRow: {
    gap: 6
  }
});
