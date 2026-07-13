import React from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "../theme";
import { AuditEntry } from "../types/domain";
import { LedgerTrailIcon } from "./CustomIcons";
import { ThemedText } from "./ThemedText";

export function AuditRail({ entries }: { entries: AuditEntry[] }) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      {entries.map((entry) => (
        <View key={entry.id} style={styles.row}>
          <View style={styles.icon}>
            <LedgerTrailIcon color={theme.colors.inkMuted} />
          </View>
          <View style={[styles.card, { borderBottomColor: theme.colors.hairline }]}>
            <ThemedText variant="bodyMedium">{entry.summary}</ThemedText>
            {entry.reason ? (
              <ThemedText variant="bodySm" tone="muted">
                Reason: {entry.reason}
              </ThemedText>
            ) : null}
            {entry.changes?.map((change) => (
              <ThemedText key={change.field} variant="bodySm" tone="muted">
                {change.detail}
              </ThemedText>
            ))}
            <ThemedText variant="caption" tone="faint">
              {entry.actorName ? `${entry.actorName} - ` : ""}
              {new Date(entry.createdAt).toLocaleString()}
            </ThemedText>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 0
  },
  row: {
    flexDirection: "row",
    gap: 12
  },
  icon: {
    width: 28,
    alignItems: "center",
    paddingTop: 2
  },
  card: {
    flex: 1,
    gap: 5,
    borderBottomWidth: 1,
    paddingBottom: 16,
    marginBottom: 16
  }
});
