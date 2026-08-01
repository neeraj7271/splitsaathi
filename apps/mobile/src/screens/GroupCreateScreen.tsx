import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  AddressBook,
  CaretDown,
  Clock,
  FileArrowDown,
  ListBullets,
  QrCode,
  SquaresFour,
  UserPlus,
  UsersThree
} from "phosphor-react-native";
import * as ImagePicker from "expo-image-picker";

import { apiClient } from "../api/client";
import { useAppDialog } from "../components/AppDialog";
import { Button } from "../components/Button";
import { ContactPicker } from "../components/ContactPicker";
import { DataSurface } from "../components/DataSurface";
import { EmptyState } from "../components/EmptyState";
import { groupTypeAccent, groupTypeIcon } from "../components/GroupTypeAvatar";
import { GroupSummaryCard } from "../components/GroupSummaryCard";
import { InlineNotice } from "../components/InlineNotice";
import { InputField } from "../components/InputField";
import { QRScannerModal } from "../components/QRScannerModal";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { SegmentedControl } from "../components/SegmentedControl";
import { ThemedText } from "../components/ThemedText";
import { UserAvatar } from "../components/UserAvatar";
import { colorWithAlpha, useTheme } from "../theme";
import { GroupMode, GroupSummary, GroupType, MembershipRole } from "../types/domain";
import { AppNavigation } from "../types/navigation";
import { ensureContactsAccess, openSystemSettings, syncDeviceContacts, type SyncedContact } from "../utils/contactDiscovery";
import { ensureMediaLibraryPermission } from "../utils/mediaPermissions";

const groupTypes: Array<{ label: string; value: GroupType }> = [
  { label: "Trip", value: "trip" },
  { label: "Couple", value: "couple" },
  { label: "Home / Flat", value: "home" },
  { label: "Event", value: "event" },
  { label: "Business", value: "business" },
  { label: "Other", value: "other" }
];

type GroupsTab = "create" | "list";
type BalanceFilter = "all" | "outstanding" | "you_owe" | "owes_you";

const tabOptions: Array<{
  label: string;
  value: GroupsTab;
  Icon: React.ComponentType<{ size?: number; color?: string; weight?: "duotone" | "bold" | "fill" | "regular" }>;
}> = [
  { label: "Create group", value: "create", Icon: UserPlus },
  { label: "Group list", value: "list", Icon: ListBullets }
];

const balanceFilters: Array<{
  label: string;
  value: BalanceFilter;
  Icon: typeof SquaresFour;
  accent: "confirmed" | "pending" | "info" | "receive";
}> = [
  { label: "All", value: "all", Icon: SquaresFour, accent: "confirmed" },
  { label: "Outstanding", value: "outstanding", Icon: Clock, accent: "pending" },
  { label: "You owe", value: "you_owe", Icon: ArrowUpRight, accent: "info" },
  { label: "Owes you", value: "owes_you", Icon: ArrowDownLeft, accent: "receive" }
];

export function GroupCreateScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const { showDialog } = useAppDialog();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<GroupsTab>("list");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<GroupMode>("flat");
  const [groupType, setGroupType] = useState<GroupType>("home");
  const [participants, setParticipants] = useState<Array<{ displayName: string; phoneE164: string; role: Exclude<MembershipRole, "owner"> }>>([]);
  const [contactPickerVisible, setContactPickerVisible] = useState(false);
  const [contactPickerLoading, setContactPickerLoading] = useState(false);
  const [availableContacts, setAvailableContacts] = useState<SyncedContact[]>([]);
  const [contactError, setContactError] = useState<string | null>(null);
  const [groupImage, setGroupImage] = useState<{ uri: string; mimeType: string; fileName?: string } | null>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);

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
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      navigation.setSelectedGroupId(group.id);
      navigation.go("groupDetail");
    }
  });

  async function selectGroupImage() {
    const granted = await ensureMediaLibraryPermission();
    if (!granted) {
      showDialog({
        title: "Photos are off",
        message: "Allow photo access to attach a group image.",
        tone: "warning",
        primaryAction: { label: "OK" }
      });
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
    const access = await ensureContactsAccess();
    if (!access.ok) {
      if (access.openSettings) {
        showDialog({
          title: "Allow contacts access",
          message: access.reason,
          tone: "warning",
          primaryAction: {
            label: "Open settings",
            onPress: () => void openSystemSettings()
          },
          secondaryAction: { label: "Cancel", variant: "ghost" }
        });
      } else {
        setContactError(access.reason);
      }
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
      const existing = new Set(current.map((participant) => participant.phoneE164));
      const additions = selected
        .filter((contact) => Boolean(contact.phoneE164) && !existing.has(contact.phoneE164))
        .map((contact) => ({
          displayName: contact.displayName,
          phoneE164: contact.phoneE164,
          role: "member" as const
        }));
      return [...current, ...additions];
    });
  }

  return (
    <Screen refreshing={groupsQuery.isRefetching} onRefresh={() => void groupsQuery.refetch()}>
      <ScreenHeader
        navigation={navigation}
        fallbackRoute="home"
        title="Groups"
        subtitle={activeTab === "create" ? "Create a new group" : "Manage your groups and balances."}
        trailing={
          <>
            <Pressable
              onPress={() => setShowQrScanner(true)}
              accessibilityRole="button"
              accessibilityLabel="Scan QR to join"
              style={[
                styles.headerIconButton,
                {
                  borderColor: colorWithAlpha(theme.colors.info, theme.mode === "dark" ? 0.45 : 0.35),
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radius.full
                }
              ]}
            >
              <QrCode size={18} color={theme.colors.info} weight="duotone" />
            </Pressable>
            <Pressable
              onPress={() => navigation.go("importExport")}
              accessibilityRole="button"
              accessibilityLabel="Import CSV"
              style={[
                styles.headerIconButton,
                {
                  borderColor: colorWithAlpha(theme.colors.info, theme.mode === "dark" ? 0.45 : 0.35),
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radius.full
                }
              ]}
            >
              <FileArrowDown size={18} color={theme.colors.info} weight="duotone" />
            </Pressable>
          </>
        }
      />

      <QRScannerModal
        visible={showQrScanner}
        onClose={() => setShowQrScanner(false)}
        onJoined={(groupId) => {
          navigation.setSelectedGroupId(groupId);
          navigation.go("groupDetail");
        }}
      />

      <SegmentedControl value={activeTab} options={tabOptions} onChange={setActiveTab} />

      {activeTab === "create" ? (
        <CreateGroupTab
          name={name}
          setName={setName}
          groupType={groupType}
          setGroupType={setGroupType}
          setMode={setMode}
          groupImage={groupImage}
          selectGroupImage={selectGroupImage}
          setGroupImage={setGroupImage}
          createGroup={createGroup}
          openContactPicker={openContactPicker}
          participants={participants}
          setParticipants={setParticipants}
          contactError={contactError}
        />
      ) : (
        <GroupListTab
          groupsQuery={groupsQuery}
          onOpenGroup={(groupId) => {
            navigation.setSelectedGroupId(groupId);
            navigation.go("groupDetail");
          }}
          onCreateGroup={() => setActiveTab("create")}
        />
      )}

      <ContactPicker
        visible={contactPickerVisible}
        contacts={availableContacts}
        loading={contactPickerLoading}
        onClose={() => setContactPickerVisible(false)}
        onConfirm={addContactsToDraft}
      />
    </Screen>
  );
}

function CreateGroupTab({
  name,
  setName,
  groupType,
  setGroupType,
  setMode,
  groupImage,
  selectGroupImage,
  setGroupImage,
  createGroup,
  openContactPicker,
  participants,
  setParticipants,
  contactError
}: {
  name: string;
  setName: (value: string) => void;
  groupType: GroupType;
  setGroupType: (value: GroupType) => void;
  setMode: (value: GroupMode) => void;
  groupImage: { uri: string; mimeType: string; fileName?: string } | null;
  selectGroupImage: () => Promise<void>;
  setGroupImage: (value: null) => void;
  createGroup: { mutate: () => void; isPending: boolean; error: Error | null };
  openContactPicker: () => Promise<void>;
  participants: Array<{ displayName: string; phoneE164: string; role: Exclude<MembershipRole, "owner"> }>;
  setParticipants: React.Dispatch<
    React.SetStateAction<Array<{ displayName: string; phoneE164: string; role: Exclude<MembershipRole, "owner"> }>>
  >;
  contactError: string | null;
}) {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      <DataSurface elevated padded>
        <View style={styles.imagePicker}>
          <UserAvatar
            displayName={name.trim() || "Group"}
            localUri={groupImage?.uri}
            size={80}
            editable
            accentColor={theme.colors.confirmed}
            onPress={() => void selectGroupImage()}
          />
          <View style={styles.imagePickerCopy}>
            <ThemedText variant="bodyMedium">{groupImage ? "Group logo" : "Add group logo"}</ThemedText>
            <ThemedText variant="bodySm" tone="muted">
              {groupImage ? "Tap the photo to change it" : "Optional · tap the camera icon"}
            </ThemedText>
            {groupImage ? (
              <Pressable onPress={() => setGroupImage(null)} accessibilityRole="button" accessibilityLabel="Remove group logo">
                <ThemedText variant="caption" tone="disputed">
                  Remove
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </DataSurface>

      <InputField
        label="Group name"
        value={name}
        onChangeText={setName}
        placeholder="Flat 3B rent and groceries"
        Icon={UsersThree}
      />

      <View style={styles.typeBlock}>
        <ThemedText variant="bodyMedium">Choose a group type</ThemedText>
        <ThemedText variant="bodySm" tone="muted">
          This helps organize your groups. You can change other details later.
        </ThemedText>
        <GroupTypePicker
          selected={groupType}
          onSelect={(type) => {
            setGroupType(type);
            setMode(type === "home" ? "flat" : type === "other" ? "custom" : type);
          }}
        />
      </View>

      <DataSurface elevated>
        <View style={styles.formBlock}>
          <View style={styles.formHeader}>
            <AddressBook size={20} color={theme.colors.confirmed} weight="duotone" />
            <View style={styles.formHeaderText}>
              <ThemedText variant="bodyMedium">Invite people</ThemedText>
              <ThemedText variant="bodySm" tone="muted">
                Add contacts with a phone number so they can be invited to the group.
              </ThemedText>
            </View>
          </View>
          <Button
            label={participants.length ? "Add more contacts" : "Add from contacts"}
            variant="soft"
            Icon={AddressBook}
            onPress={() => void openContactPicker()}
          />
        </View>
        {participants.length ? (
          participants.map((participant, index) => (
            <View key={participant.phoneE164} style={[styles.draftRow, { borderTopColor: theme.colors.hairline }]}>
              <View style={styles.participantCopy}>
                <ThemedText variant="bodyMedium">{participant.displayName}</ThemedText>
                <ThemedText variant="bodySm" tone="muted">
                  {participant.phoneE164}
                </ThemedText>
              </View>
              <Pressable onPress={() => setParticipants((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                <ThemedText variant="caption" tone="disputed">
                  Remove
                </ThemedText>
              </Pressable>
            </View>
          ))
        ) : (
          <View style={[styles.emptyPeople, { borderTopColor: theme.colors.hairline }]}>
            <ThemedText variant="bodySm" tone="muted">
              No one invited yet. You can also create the group alone and invite later.
            </ThemedText>
          </View>
        )}
      </DataSurface>

      <Button
        label="Create group"
        Icon={UsersThree}
        onPress={() => createGroup.mutate()}
        loading={createGroup.isPending}
        disabled={!name.trim()}
      />
      {createGroup.error ? <InlineNotice title="Group could not be created" body={createGroup.error.message} tone="owe" /> : null}
      {contactError ? <InlineNotice title="Contacts unavailable" body={contactError} tone="owe" /> : null}
    </View>
  );
}

function GroupListTab({
  groupsQuery,
  onOpenGroup,
  onCreateGroup
}: {
  groupsQuery: {
    data?: GroupSummary[];
    error: Error | null;
    isLoading: boolean;
    isFetching: boolean;
  };
  onOpenGroup: (groupId: string) => void;
  onCreateGroup: () => void;
}) {
  const theme = useTheme();
  const [filter, setFilter] = useState<BalanceFilter>("all");
  const groups = groupsQuery.data ?? [];
  const activeGroups = groups.filter((group) => group.state !== "archived");
  const settledGroups = activeGroups.filter((group) => (group.netBalanceMinor ?? 0) === 0);
  const filtered = activeGroups.filter((group) => {
    const net = group.netBalanceMinor ?? 0;
    if (filter === "all") {
      return net !== 0;
    }
    if (filter === "outstanding") {
      return net !== 0;
    }
    if (filter === "you_owe") {
      return net < 0;
    }
    return net > 0;
  });

  return (
    <View style={styles.section}>
      {groupsQuery.error ? <InlineNotice title="Groups could not load" body={groupsQuery.error.message} tone="owe" /> : null}
      <BalanceFilterChips value={filter} onChange={setFilter} />
      {groupsQuery.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.inkMuted} />
        </View>
      ) : filtered.length ? (
        <GroupSection
          title={filter === "all" ? "Outstanding balances" : "Groups"}
          groups={filtered}
          onOpenGroup={onOpenGroup}
        />
      ) : (
        <EmptyState
          title={activeGroups.length ? "No groups in this filter" : "No groups yet"}
          body={
            activeGroups.length
              ? filter === "all" && settledGroups.length
                ? "All your groups are settled up."
                : "Try another filter or settle balances to clear outstanding groups."
              : "Create a group or accept an invite from a friend to get started."
          }
          action={activeGroups.length ? undefined : { label: "Create group", onPress: onCreateGroup }}
        />
      )}

      {filter === "all" && settledGroups.length ? (
        <GroupSection title="Settled up groups" groups={settledGroups} onOpenGroup={onOpenGroup} />
      ) : null}
    </View>
  );
}

function BalanceFilterChips({
  value,
  onChange
}: {
  value: BalanceFilter;
  onChange: (value: BalanceFilter) => void;
}) {
  const theme = useTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
      {balanceFilters.map((option) => {
        const active = option.value === value;
        const accent = theme.colors[option.accent];
        const Icon = option.Icon;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.filterChip,
              {
                borderRadius: theme.radius.full,
                borderColor: active ? accent : theme.colors.hairline,
                backgroundColor: active
                  ? colorWithAlpha(accent, theme.mode === "dark" ? 0.16 : 0.08)
                  : theme.colors.surface
              }
            ]}
          >
            <Icon size={14} color={accent} weight="duotone" />
            <ThemedText variant="caption" style={{ color: active ? accent : theme.colors.inkMuted }}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function GroupSection({
  title,
  groups,
  onOpenGroup
}: {
  title: string;
  groups: GroupSummary[];
  onOpenGroup: (groupId: string) => void;
}) {
  const theme = useTheme();
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 5;
  const countLabel = `${groups.length} group${groups.length === 1 ? "" : "s"}`;
  const visibleGroups = showAll ? groups : groups.slice(0, LIMIT);
  const hasMore = groups.length > LIMIT;

  return (
    <View style={styles.listSection}>
      <View style={styles.sectionHeader}>
        <ThemedText variant="bodyMedium">{title}</ThemedText>
        <ThemedText variant="caption" tone="muted">
          {countLabel}
        </ThemedText>
      </View>
      <View style={styles.groupStack}>
        {visibleGroups.map((group) => (
          <GroupSummaryCard
            key={group.id}
            group={group}
            subtitle={groupMetaLabel(group)}
            onPress={() => onOpenGroup(group.id)}
          />
        ))}
      </View>
      {hasMore ? (
        <Pressable
          onPress={() => setShowAll((prev) => !prev)}
          style={[
            styles.seeAllButton,
            {
              borderColor: theme.colors.hairline,
              backgroundColor: colorWithAlpha(theme.colors.info, theme.mode === "dark" ? 0.16 : 0.08)
            }
          ]}
        >
          <ThemedText variant="bodySm" style={{ color: theme.colors.info, fontWeight: "600" }}>
            {showAll ? "Show less" : `See all (${groups.length})`}
          </ThemedText>
          <CaretDown size={14} color={theme.colors.info} style={{ transform: [{ rotate: showAll ? "180deg" : "0deg" }] }} />
        </Pressable>
      ) : null}
    </View>
  );
}

function groupMetaLabel(group: GroupSummary) {
  const typeLabel = group.groupType ? formatGroupType(group.groupType) : null;
  const members = `${group.participantCount ?? 0} Members`;
  return typeLabel ? `${typeLabel} · ${members}` : members;
}

function GroupTypePicker({ selected, onSelect }: { selected: GroupType; onSelect: (value: GroupType) => void }) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
      {groupTypes.map((option) => {
        const active = selected === option.value;
        const tint = groupTypeAccent(option.value);
        const Icon = groupTypeIcon(option.value);
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            style={[
              styles.typeChip,
              {
                borderRadius: theme.radius.full,
                borderColor: active ? tint : theme.colors.hairline,
                backgroundColor: active
                  ? colorWithAlpha(tint, theme.mode === "dark" ? 0.18 : 0.1)
                  : theme.colors.surface
              }
            ]}
          >
            <Icon size={14} color={tint} weight="duotone" />
            <ThemedText variant="caption" style={{ color: tint }}>
              {option.label}
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
  headerIconButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1
  },
  section: {
    gap: 16
  },
  typeBlock: {
    gap: 8
  },
  typeRow: {
    gap: 8,
    paddingRight: 8,
    paddingTop: 4
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1
  },
  filterRow: {
    gap: 8,
    paddingRight: 8
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1
  },
  listSection: {
    gap: 10
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  groupStack: {
    gap: 8
  },
  loading: {
    paddingVertical: 32,
    alignItems: "center"
  },
  formBlock: {
    gap: 12,
    padding: 14
  },
  imagePicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  imagePickerCopy: {
    flex: 1,
    gap: 4
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
  participantCopy: {
    flex: 1,
    gap: 2
  },
  emptyPeople: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 4,
    borderTopWidth: 1
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4
  }
});
