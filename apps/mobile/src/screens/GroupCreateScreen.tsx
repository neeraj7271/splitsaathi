import React, { useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, LinkSimple, UserPlus } from "phosphor-react-native";
import * as ImagePicker from "expo-image-picker";

import { apiClient } from "../api/client";
import { Button } from "../components/Button";
import { ContactPicker } from "../components/ContactPicker";
import { DataSurface } from "../components/DataSurface";
import { EmptyState } from "../components/EmptyState";
import { InlineNotice } from "../components/InlineNotice";
import { InputField } from "../components/InputField";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { StatusPill } from "../components/StatusPill";
import { ThemedText } from "../components/ThemedText";
import { UserAvatar } from "../components/UserAvatar";
import { useTheme } from "../theme";
import { GroupMode, GroupType, MembershipRole } from "../types/domain";
import { AppNavigation } from "../types/navigation";
import { hasContactsConsent, syncDeviceContacts, type SyncedContact } from "../utils/contactDiscovery";
import { formatSignedMoney } from "../utils/money";

const groupTypes: Array<{ label: string; value: GroupType }> = [
  { label: "Trip", value: "trip" },
  { label: "Couple", value: "couple" },
  { label: "Home / Flat", value: "home" },
  { label: "Event", value: "event" },
  { label: "Business", value: "business" },
  { label: "Other", value: "other" }
];

export function GroupCreateScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<GroupMode>("flat");
  const [groupType, setGroupType] = useState<GroupType>("home");
  const [participantName, setParticipantName] = useState("");
  const [participants, setParticipants] = useState<Array<{ displayName: string; phoneE164?: string; role: Exclude<MembershipRole, "owner"> }>>([]);
  const [contactPickerVisible, setContactPickerVisible] = useState(false);
  const [contactPickerLoading, setContactPickerLoading] = useState(false);
  const [availableContacts, setAvailableContacts] = useState<SyncedContact[]>([]);
  const [contactError, setContactError] = useState<string | null>(null);
  const [groupImage, setGroupImage] = useState<{ uri: string; mimeType: string; fileName?: string } | null>(null);

  const groupsQuery = useQuery({ queryKey: ["groups"], queryFn: () => apiClient.listGroups() });
  const createGroup = useMutation({
    mutationFn: async () => {
      const uploaded = groupImage
        ? await apiClient.uploadAttachment(
            { uri: groupImage.uri, name: groupImage.fileName ?? "group-image.jpg", type: groupImage.mimeType },
            "group_image"
          )
        : undefined;
      return apiClient.createGroup({
        name,
        mode,
        groupType,
        imageAttachmentId: uploaded?.id,
        baseCurrencyCode: "INR",
        participants
      });
    },
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
        role: "member"
      }
    ]);
    setParticipantName("");
  };

  async function selectGroupImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photos are off", "Allow photo access to attach a group image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1]
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setGroupImage({ uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg", fileName: asset.fileName ?? undefined });
    }
  }

  async function openContactPicker() {
    setContactError(null);
    const granted = await hasContactsConsent();
    if (!granted) {
      Alert.alert("Contacts are off", "Enable contacts in Settings → Contacts, then try again.", [
        { text: "Open settings", onPress: () => navigation.go("contactsSettings") },
        { text: "Cancel", style: "cancel" }
      ]);
      return;
    }

    setContactPickerVisible(true);
    setContactPickerLoading(true);
    try {
      const result = await syncDeviceContacts();
      setAvailableContacts(result.contacts);
    } catch (error) {
      setContactPickerVisible(false);
      setContactError(error instanceof Error ? error.message : "Contacts could not be loaded.");
    } finally {
      setContactPickerLoading(false);
    }
  }

  function addContactsToDraft(selected: SyncedContact[]) {
    setParticipants((current) => {
      const existing = new Set(current.map((participant) => participant.phoneE164 ?? participant.displayName.toLowerCase()));
      const additions = selected
        .filter((contact) => !existing.has(contact.phoneE164) && !existing.has(contact.displayName.toLowerCase()))
        .map((contact) => ({
          displayName: contact.displayName,
          phoneE164: contact.phoneE164,
          role: "member" as const
        }));
      return [...current, ...additions];
    });
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText variant="title">Groups</ThemedText>
        <Button label="Import CSV" variant="secondary" onPress={() => navigation.go("importExport")} />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Create group" />
        <InputField label="Group name" value={name} onChangeText={setName} placeholder="Flat 3B rent and groceries" />
        <View style={styles.imagePicker}>
          {groupImage ? <Image source={{ uri: groupImage.uri }} style={styles.groupImage} /> : null}
          <Button label={groupImage ? "Change group image" : "Add group image"} variant="secondary" onPress={() => void selectGroupImage()} />
          {groupImage ? <Button label="Remove image" variant="ghost" onPress={() => setGroupImage(null)} /> : null}
        </View>
        <ThemedText variant="bodyMedium">Choose a group type</ThemedText>
        <ThemedText variant="bodySm" tone="muted">This helps organize your groups. You can change other details later.</ThemedText>
        <GroupTypePicker
          selected={groupType}
          onSelect={(type) => {
            setGroupType(type);
            setMode(type === "home" ? "flat" : type === "other" ? "custom" : type);
          }}
        />
        <Button label="Create group" onPress={() => createGroup.mutate()} loading={createGroup.isPending} disabled={!name.trim()} />

        <DataSurface>
          <View style={styles.formBlock}>
            <View style={styles.formHeader}>
              <UserPlus size={20} color={theme.colors.inkMuted} weight="duotone" />
              <View style={styles.formHeaderText}>
                <ThemedText variant="bodyMedium">Add people by name</ThemedText>
                <ThemedText variant="bodySm" tone="muted">
                  Type a name manually or pick from your phone contacts.
                </ThemedText>
              </View>
            </View>
            <InputField label="Name" value={participantName} onChangeText={setParticipantName} placeholder="e.g. Priya" />
            <Button label="Add name" variant="secondary" onPress={addDraftParticipant} disabled={!participantName.trim()} />
            <Button label="Add from contacts" variant="secondary" onPress={() => void openContactPicker()} />
          </View>
          {participants.map((participant, index) => (
            <View key={`${participant.displayName}-${index}`} style={[styles.draftRow, { borderTopColor: theme.colors.hairline }]}>
              <View>
                <ThemedText variant="bodyMedium">{participant.displayName}</ThemedText>
                {participant.phoneE164 ? (
                  <ThemedText variant="bodySm" tone="muted">
                    {participant.phoneE164}
                  </ThemedText>
                ) : null}
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
        {contactError ? <InlineNotice title="Contacts unavailable" body={contactError} tone="owe" /> : null}
      </View>

      <ContactPicker
        visible={contactPickerVisible}
        contacts={availableContacts}
        loading={contactPickerLoading}
        onClose={() => setContactPickerVisible(false)}
        onConfirm={addContactsToDraft}
      />

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
                <UserAvatar displayName={group.name} avatarUrl={group.imageUrl} size={40} />
                <View style={styles.groupText}>
                  <ThemedText variant="bodyMedium">{group.name}</ThemedText>
                  <ThemedText variant="bodySm" tone="muted">
                    {group.groupType ? `${formatGroupType(group.groupType)} · ` : ""}{group.participantCount ?? 0} members
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

function GroupTypePicker({ selected, onSelect }: { selected: GroupType; onSelect: (value: GroupType) => void }) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
      {groupTypes.map((groupType) => {
        const active = selected === groupType.value;
        return (
          <Pressable
            key={groupType.value}
            onPress={() => onSelect(groupType.value)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: theme.radius.sm,
              borderWidth: 1,
              borderColor: active ? theme.colors.confirmed : theme.colors.hairline,
              backgroundColor: active ? theme.colors.surface : theme.colors.surfaceRaised
            }}
          >
            <ThemedText variant="caption" tone={active ? "confirmed" : "muted"}>
              {groupType.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function formatGroupType(groupType: GroupType): string {
  return groupTypes.find((option) => option.value === groupType)?.label ?? "Other";
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
  imagePicker: {
    alignItems: "flex-start",
    gap: 8
  },
  groupImage: {
    width: 72,
    height: 72,
    borderRadius: 36
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  formHeaderText: {
    flex: 1,
    gap: 4
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
