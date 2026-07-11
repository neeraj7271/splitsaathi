import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, LinkSimple, UserPlus } from "phosphor-react-native";

import { apiClient } from "../api/client";
import { Button } from "../components/Button";
import { DataSurface } from "../components/DataSurface";
import { EmptyState } from "../components/EmptyState";
import { InlineNotice } from "../components/InlineNotice";
import { InputField } from "../components/InputField";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { SegmentedControl } from "../components/SegmentedControl";
import { StatusPill } from "../components/StatusPill";
import { ThemedText } from "../components/ThemedText";
import { useTheme } from "../theme";
import { GroupMode, MembershipRole } from "../types/domain";
import { AppNavigation } from "../types/navigation";
import { formatSignedMoney } from "../utils/money";

const modes: Array<{ label: string; value: GroupMode }> = [
  { label: "Flat", value: "flat" },
  { label: "Trip", value: "trip" },
  { label: "Couple", value: "couple" },
  { label: "Event", value: "event" },
  { label: "Business", value: "business" }
];

export function GroupCreateScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<GroupMode>("flat");
  const [participantName, setParticipantName] = useState("");
  const [participantPhone, setParticipantPhone] = useState("");
  const [participantRole, setParticipantRole] = useState<Exclude<MembershipRole, "owner">>("member");
  const [participants, setParticipants] = useState<Array<{ displayName: string; phoneE164?: string; role: Exclude<MembershipRole, "owner"> }>>([]);

  const groupsQuery = useQuery({ queryKey: ["groups"], queryFn: () => apiClient.listGroups() });
  const createGroup = useMutation({
    mutationFn: () =>
      apiClient.createGroup({
        name,
        mode,
        baseCurrencyCode: "INR",
        participants
      }),
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      navigation.setSelectedGroupId(group.id);
      navigation.go("groupDetail");
    }
  });

  const addDraftParticipant = () => {
    if (!participantName.trim()) {
      return;
    }
    setParticipants((current) => [
      ...current,
      {
        displayName: participantName.trim(),
        phoneE164: participantPhone.trim() || undefined,
        role: participantRole
      }
    ]);
    setParticipantName("");
    setParticipantPhone("");
    setParticipantRole("member");
  };

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText variant="title">Groups</ThemedText>
        <Button label="Import CSV" variant="secondary" onPress={() => navigation.go("importExport")} />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Create group" />
        <InputField label="Group name" value={name} onChangeText={setName} placeholder="Flat 3B rent and groceries" />
        <SegmentedControl value={mode} options={modes} onChange={setMode} />
        <InlineNotice title="Invite-first by default" body="Add names manually now. Invite links and optional contacts can come later." tone="confirmed" />

        <DataSurface>
          <View style={styles.formBlock}>
            <View style={styles.formHeader}>
              <UserPlus size={20} color={theme.colors.inkMuted} weight="duotone" />
              <ThemedText variant="bodyMedium">Participants</ThemedText>
            </View>
            <InputField label="Name" value={participantName} onChangeText={setParticipantName} />
            <InputField label="Phone optional" value={participantPhone} onChangeText={setParticipantPhone} keyboardType="phone-pad" />
            <SegmentedControl
              value={participantRole}
              options={[
                { label: "Admin", value: "admin" },
                { label: "Member", value: "member" },
                { label: "Viewer", value: "viewer" }
              ]}
              onChange={setParticipantRole}
            />
            <Button label="Add participant" variant="secondary" onPress={addDraftParticipant} disabled={!participantName.trim()} />
          </View>
          {participants.map((participant, index) => (
            <View key={`${participant.displayName}-${index}`} style={[styles.draftRow, { borderTopColor: theme.colors.hairline }]}>
              <View>
                <ThemedText variant="bodyMedium">{participant.displayName}</ThemedText>
                <ThemedText variant="bodySm" tone="muted">
                  {participant.phoneE164 || "No phone yet"} - {participant.role}
                </ThemedText>
              </View>
              <Pressable onPress={() => setParticipants((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                <ThemedText variant="caption" tone="disputed">
                  Remove
                </ThemedText>
              </Pressable>
            </View>
          ))}
        </DataSurface>

        {createGroup.error ? <InlineNotice title="Group could not be created" body={createGroup.error.message} tone="owe" /> : null}
        <Button label="Create group" onPress={() => createGroup.mutate()} loading={createGroup.isPending} disabled={!name.trim()} />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Manage existing" />
        {groupsQuery.error ? <InlineNotice title="Groups could not load" body={groupsQuery.error.message} tone="owe" /> : null}
        {groupsQuery.data?.length ? (
          <DataSurface>
            {groupsQuery.data.map((group) => (
              <Pressable
                key={group.id}
                onPress={() => {
                  navigation.setSelectedGroupId(group.id);
                  navigation.go("groupDetail");
                }}
                style={[styles.groupRow, { borderBottomColor: theme.colors.hairline }]}
              >
                <View style={styles.groupText}>
                  <ThemedText variant="bodyMedium">{group.name}</ThemedText>
                  <ThemedText variant="bodySm" tone="muted">
                    {group.mode} - {group.participantCount ?? 0} members
                  </ThemedText>
                </View>
                <View style={styles.trailing}>
                  {group.state === "archived" ? <StatusPill state="expired" /> : null}
                  <ThemedText variant="amountSm" tone={(group.netBalanceMinor ?? 0) >= 0 ? "receive" : "owe"}>
                    {formatSignedMoney(group.netBalanceMinor, group.baseCurrencyCode)}
                  </ThemedText>
                </View>
              </Pressable>
            ))}
          </DataSurface>
        ) : (
          <EmptyState title="No groups yet" body="Create a group or import a Splitwise CSV to start." />
        )}
      </View>

      <View style={styles.managementNotes}>
        <View style={styles.noteRow}>
          <LinkSimple size={18} color={theme.colors.inkMuted} weight="duotone" />
          <ThemedText variant="bodySm" tone="muted">
            Invite links are generated inside each group.
          </ThemedText>
        </View>
        <View style={styles.noteRow}>
          <Archive size={18} color={theme.colors.inkMuted} weight="duotone" />
          <ThemedText variant="bodySm" tone="muted">
            Financial groups are archived instead of deleted.
          </ThemedText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  section: {
    gap: 12
  },
  formBlock: {
    gap: 12,
    padding: 14
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  draftRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderTopWidth: 1,
    gap: 12
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderBottomWidth: 1,
    gap: 12
  },
  groupText: {
    flex: 1,
    gap: 4
  },
  trailing: {
    alignItems: "flex-end",
    gap: 6
  },
  managementNotes: {
    gap: 8
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  }
});
