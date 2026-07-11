import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Check } from "phosphor-react-native";

import { useTheme } from "../theme";
import { Participant } from "../types/domain";
import { participantColor } from "../utils/participantColor";
import { ThemedText } from "./ThemedText";

export function ParticipantPicker({
  participants,
  selectedIds,
  onToggle,
  title
}: {
  title: string;
  participants: Participant[];
  selectedIds: string[];
  onToggle: (participantId: string) => void;
}) {
  const theme = useTheme();
  const onColor = theme.mode === "dark" ? theme.colors.ink : theme.colors.surface;

  return (
    <View style={styles.section}>
      <ThemedText variant="section">{title}</ThemedText>
      <View style={styles.list}>
        {participants.map((participant) => {
          const selected = selectedIds.includes(participant.id);
          const ring = participantColor(participant.id);

          return (
            <Pressable
              key={participant.id}
              onPress={() => onToggle(participant.id)}
              style={[
                styles.row,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: selected ? ring : theme.colors.hairline,
                  borderRadius: theme.radius.md
                }
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: ring }]}>
                <ThemedText variant="caption" style={{ color: onColor }}>
                  {participant.displayName.slice(0, 1).toUpperCase()}
                </ThemedText>
              </View>
              <View style={styles.name}>
                <ThemedText variant="bodyMedium">{participant.displayName}</ThemedText>
                <ThemedText variant="bodySm" tone="muted">
                  {participant.phoneE164 || participant.participantType || "guest or invite"}
                </ThemedText>
              </View>
              <View style={[styles.checkbox, { borderColor: selected ? ring : theme.colors.inkFaint, backgroundColor: selected ? ring : "transparent" }]}>
                {selected ? <Check size={14} color={onColor} weight="bold" /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12
  },
  list: {
    gap: 8
  },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    padding: 12
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  name: {
    flex: 1,
    gap: 3
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  }
});
