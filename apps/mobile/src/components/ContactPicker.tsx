import React, { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, View } from "react-native";
import { Check, X } from "phosphor-react-native";

import { InputField } from "./InputField";
import { StatusPill } from "./StatusPill";
import { ThemedText } from "./ThemedText";
import { useTheme } from "../theme";
import type { SyncedContact } from "../utils/contactDiscovery";

interface ContactPickerProps {
  visible: boolean;
  contacts: SyncedContact[];
  loading?: boolean;
  selectedPhoneHashes?: string[];
  onClose: () => void;
  onConfirm: (selected: SyncedContact[]) => void;
}

export function ContactPicker({
  visible,
  contacts,
  loading = false,
  selectedPhoneHashes = [],
  onClose,
  onConfirm
}: ContactPickerProps) {
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedPhoneHashes));

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return contacts;
    }
    return contacts.filter((contact) => contact.displayName.toLowerCase().includes(normalized));
  }, [contacts, query]);

  function toggleContact(phoneHash: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(phoneHash)) {
        next.delete(phoneHash);
      } else {
        next.add(phoneHash);
      }
      return next;
    });
  }

  function confirmSelection() {
    onConfirm(contacts.filter((contact) => selected.has(contact.phoneHash)));
    setQuery("");
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
        <View style={styles.header}>
          <ThemedText variant="title">Choose contacts</ThemedText>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={22} color={theme.colors.ink} />
          </Pressable>
        </View>

        <InputField label="Search" value={query} onChangeText={setQuery} placeholder="Search by name" />

        {loading ? (
          <ThemedText variant="bodySm" tone="muted">
            Reading contacts from your phone...
          </ThemedText>
        ) : null}

        {!loading && !contacts.length ? (
          <ThemedText variant="bodySm" tone="muted">
            No contacts with phone numbers were found.
          </ThemedText>
        ) : null}

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.phoneHash}
          style={styles.list}
          renderItem={({ item }) => {
            const isSelected = selected.has(item.phoneHash);
            return (
              <Pressable
                onPress={() => toggleContact(item.phoneHash)}
                style={[
                  styles.row,
                  {
                    borderColor: isSelected ? theme.colors.confirmed : theme.colors.hairline,
                    backgroundColor: theme.colors.surface
                  }
                ]}
              >
                <View style={styles.rowText}>
                  <ThemedText variant="bodyMedium">{item.displayName}</ThemedText>
                  <ThemedText variant="bodySm" tone="muted">
                    {item.phoneE164}
                  </ThemedText>
                </View>
                <View style={styles.rowTrailing}>
                  {item.onSplitSaathi ? <StatusPill state="confirmed" /> : null}
                  <View style={[styles.check, { borderColor: isSelected ? theme.colors.confirmed : theme.colors.hairline, backgroundColor: isSelected ? theme.colors.confirmed : "transparent" }]}>
                    {isSelected ? <Check size={14} color={theme.colors.surface} weight="bold" /> : null}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />

        <Pressable
          onPress={confirmSelection}
          disabled={!selected.size}
          style={[styles.confirmButton, { backgroundColor: selected.size ? theme.colors.confirmed : theme.colors.hairline }]}
        >
          <ThemedText variant="bodyMedium" style={{ color: theme.colors.surface }}>
            Add {selected.size || ""} selected
          </ThemedText>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 16,
    gap: 12
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  closeButton: {
    padding: 4
  },
  list: {
    flex: 1
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8
  },
  rowText: {
    flex: 1,
    gap: 4
  },
  rowTrailing: {
    alignItems: "flex-end",
    gap: 8
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  confirmButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center"
  }
});
