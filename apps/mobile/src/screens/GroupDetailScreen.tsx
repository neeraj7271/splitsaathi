import React, { useMemo, useState } from "react";
import { Pressable, Share, StyleSheet, View } from "react-native";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CaretLeft, ImageSquare, LinkSimple, LockKey, LockKeyOpen, PencilSimple, Trash, UserMinus, UserPlus } from "phosphor-react-native";
import * as ImagePicker from "expo-image-picker";
import QRCode from "react-native-qrcode-svg";

import { ApiError, apiClient } from "../api/client";
import { ActionSheet } from "../components/ActionSheet";
import { useAppDialog } from "../components/AppDialog";
import { ActivityRow } from "../components/ActivityRow";
import { Button } from "../components/Button";
import { ContactPicker } from "../components/ContactPicker";
import { DataSurface } from "../components/DataSurface";
import { EmptyState } from "../components/EmptyState";
import { GroupSelector } from "../components/GroupSelector";
import { InlineNotice } from "../components/InlineNotice";
import { SpendingCharts } from "../components/SpendingCharts";
import { InputField } from "../components/InputField";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { SegmentedControl } from "../components/SegmentedControl";
import { SettingsToggleRow } from "../components/SettingsToggleRow";
import { StatusPill } from "../components/StatusPill";
import { ThemedText } from "../components/ThemedText";
import { UserAvatar } from "../components/UserAvatar";
import { useTheme } from "../theme";
import { ExpenseExplanation, GroupDetail, MembershipRole } from "../types/domain";
import { AppNavigation } from "../types/navigation";
import { formatMoney, formatSignedMoney } from "../utils/money";
import { buildGroupDisplayLookups, enrichActivityRows, enrichBalanceRows, participantList, resolveParticipantDisplayName } from "../utils/displayNames";
import { activeGroupMemberships, activeGroupParticipants } from "../utils/groupPeople";
import { isLedgerActivityEvent } from "../utils/activityFeed";
import { hasContactsConsent, syncDeviceContacts, type SyncedContact } from "../utils/contactDiscovery";
import { clearAuthenticatedImageCache } from "../utils/authenticatedImage";

type GroupTab = "activity" | "balances" | "expenses" | "charts" | "people";
const ACTIVITY_PAGE_SIZE = 20;

function apiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const payload = error.payload;
    if (typeof payload === "object" && payload && "message" in payload) {
      const message = (payload as { message: unknown }).message;
      if (Array.isArray(message)) {
        return message.map(String).join(", ");
      }
      if (message != null) {
        return String(message);
      }
    }
    return error.message || fallback;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export function GroupDetailScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const { showDialog } = useAppDialog();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<GroupTab>("activity");
  const [explainingExpenseId, setExplainingExpenseId] = useState<string>();
  const [newParticipantName, setNewParticipantName] = useState("");
  const [newParticipantPhone, setNewParticipantPhone] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string>();
  const [contactPickerVisible, setContactPickerVisible] = useState(false);
  const [contactPickerLoading, setContactPickerLoading] = useState(false);
  const [availableContacts, setAvailableContacts] = useState<SyncedContact[]>([]);
  const [contactError, setContactError] = useState<string | null>(null);
  const [reportDays, setReportDays] = useState<30 | 90 | 180>(90);
  const [logoSheetVisible, setLogoSheetVisible] = useState(false);
  const [membershipActionError, setMembershipActionError] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [expenseVoidReason, setExpenseVoidReason] = useState("");
  const [expenseActionError, setExpenseActionError] = useState<string | null>(null);

  const groupsQuery = useQuery({ queryKey: ["groups"], queryFn: () => apiClient.listGroups() });
  const profileQuery = useQuery({ queryKey: ["me"], queryFn: () => apiClient.getMe() });
  const selectedGroupId = navigation.selectedGroupId ?? groupsQuery.data?.[0]?.id;
  const groupQuery = useQuery({
    queryKey: ["group", selectedGroupId],
    queryFn: () => apiClient.getGroup(selectedGroupId as string),
    enabled: Boolean(selectedGroupId)
  });
  const activityQuery = useInfiniteQuery({
    queryKey: ["groupActivity", selectedGroupId, "ledger"],
    queryFn: ({ pageParam }) =>
      apiClient.getGroupActivity(selectedGroupId as string, {
        limit: ACTIVITY_PAGE_SIZE,
        cursor: pageParam,
        feed: "ledger"
      }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(selectedGroupId)
  });
  const balancesQuery = useQuery({
    queryKey: ["balances", selectedGroupId],
    queryFn: () => apiClient.getBalances(selectedGroupId as string),
    enabled: Boolean(selectedGroupId)
  });
  const expensesQuery = useQuery({
    queryKey: ["expenses", selectedGroupId],
    queryFn: () => apiClient.listExpenses(selectedGroupId as string),
    enabled: Boolean(selectedGroupId)
  });
  const reportRange = useMemo(() => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(to.getDate() - reportDays + 1);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }, [reportDays]);
  const monthlyReportQuery = useQuery({
    queryKey: ["reports", "monthly", selectedGroupId, reportRange],
    queryFn: () => apiClient.getMonthlyComparisonReport(selectedGroupId as string, reportRange),
    enabled: Boolean(selectedGroupId) && tab === "charts"
  });
  const contributionsReportQuery = useQuery({
    queryKey: ["reports", "contributions", selectedGroupId, reportRange],
    queryFn: () => apiClient.getMemberContributionsReport(selectedGroupId as string, reportRange),
    enabled: Boolean(selectedGroupId) && tab === "charts"
  });
  const settlementMethodsReportQuery = useQuery({
    queryKey: ["reports", "settlementMethods", selectedGroupId, reportRange],
    queryFn: () => apiClient.getSettlementMethodsReport(selectedGroupId as string, reportRange),
    enabled: Boolean(selectedGroupId) && tab === "charts"
  });
  const netPositionReportQuery = useQuery({
    queryKey: ["reports", "netPosition", selectedGroupId, reportRange],
    queryFn: () => apiClient.getNetPositionReport(selectedGroupId as string, reportRange),
    enabled: Boolean(selectedGroupId) && tab === "charts"
  });
  const explanationQuery = useQuery({
    queryKey: ["expenseExplanation", explainingExpenseId],
    queryFn: () => apiClient.explainExpense(explainingExpenseId as string),
    enabled: Boolean(explainingExpenseId)
  });
  const expenseHistoryQuery = useQuery({
    queryKey: ["expenseHistory", explainingExpenseId],
    queryFn: () => apiClient.getExpenseHistory(explainingExpenseId as string),
    enabled: Boolean(explainingExpenseId)
  });

  const addParticipant = useMutation({
    mutationFn: () => apiClient.addParticipant(selectedGroupId as string, newParticipantName, newParticipantPhone || undefined),
    onSuccess: () => {
      setNewParticipantName("");
      setNewParticipantPhone("");
      queryClient.invalidateQueries({ queryKey: ["group", selectedGroupId] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    }
  });
  const createInvite = useMutation({
    mutationFn: () => apiClient.createInvite(selectedGroupId as string),
    onSuccess: (response) => setInviteUrl(response.inviteUrl)
  });
  const archiveGroup = useMutation({
    mutationFn: () => apiClient.archiveGroup(selectedGroupId as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["group", selectedGroupId] });
      navigation.setSelectedGroupId(undefined);
      navigation.go("groups");
    }
  });
  const unarchiveGroup = useMutation({
    mutationFn: () => apiClient.unarchiveGroup(selectedGroupId as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["group", selectedGroupId] });
    }
  });
  const renameGroup = useMutation({
    mutationFn: (name: string) => apiClient.updateGroup(selectedGroupId as string, { name }),
    onSuccess: (updated) => {
      setRenameError(null);
      setEditingGroupName(false);
      setGroupNameDraft(updated.name);
      queryClient.invalidateQueries({ queryKey: ["group", selectedGroupId] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (error) => {
      setRenameError(apiErrorMessage(error, "Could not rename group."));
    }
  });

  const setMembersCanEditExpenses = useMutation({
    mutationFn: (membersCanEditExpenses: boolean) =>
      apiClient.updateGroup(selectedGroupId as string, { membersCanEditExpenses }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", selectedGroupId] });
    }
  });

  function beginRenameGroup(options?: { openPeopleTab?: boolean }) {
    setRenameError(null);
    setGroupNameDraft(groupQuery.data?.name ?? "");
    setEditingGroupName(true);
    if (options?.openPeopleTab) {
      setTab("people");
    }
  }

  function confirmDeleteGroup() {
    showDialog({
      title: "Delete this group?",
      message:
        "The group will be removed from your active list. Expense and settlement history is kept for audit — you can restore it later.",
      tone: "warning",
      secondaryAction: { label: "Cancel", variant: "secondary" },
      primaryAction: {
        label: "Delete group",
        variant: "destructive",
        onPress: () => archiveGroup.mutate()
      }
    });
  }

  const voidExpense = useMutation({
    mutationFn: async () => {
      if (!explainingExpenseId || !selectedGroupId) {
        throw new Error("Expense is not selected.");
      }
      const reason = expenseVoidReason.trim();
      if (!reason) {
        throw new Error("Add a reason before deleting this expense.");
      }
      const expense = expensesQuery.data?.find((row) => row.id === explainingExpenseId);
      await apiClient.voidExpense(explainingExpenseId, reason, selectedGroupId, expense?.currentVersion);
    },
    onSuccess: async () => {
      setExpenseActionError(null);
      setExpenseVoidReason("");
      setExplainingExpenseId(undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expenses", selectedGroupId] }),
        queryClient.invalidateQueries({ queryKey: ["balances", selectedGroupId] }),
        queryClient.invalidateQueries({ queryKey: ["groupActivity", selectedGroupId] }),
        queryClient.invalidateQueries({ queryKey: ["group", selectedGroupId] }),
        queryClient.invalidateQueries({ queryKey: ["groups"] })
      ]);
    },
    onError: (error) => {
      setExpenseActionError(apiErrorMessage(error, "Could not delete expense."));
    }
  });

  function confirmVoidExpense() {
    if (!expenseVoidReason.trim()) {
      setExpenseActionError("Add a delete reason before removing this expense.");
      return;
    }
    showDialog({
      title: "Delete this expense?",
      message: "Balances reverse immediately. The reason is stored in audit history and other members are notified.",
      tone: "warning",
      secondaryAction: { label: "Cancel", variant: "secondary" },
      primaryAction: {
        label: "Delete expense",
        variant: "destructive",
        onPress: () => voidExpense.mutate()
      }
    });
  }

  const leaveGroup = useMutation({
    mutationFn: () => apiClient.leaveGroup(selectedGroupId as string),
    onSuccess: () => {
      setMembershipActionError(null);
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["group", selectedGroupId] });
      navigation.setSelectedGroupId(undefined);
      navigation.go("groups");
    },
    onError: (error) => {
      setMembershipActionError(apiErrorMessage(error, "Could not leave group."));
    }
  });
  const removeMember = useMutation({
    mutationFn: (membershipId: string) => apiClient.removeMember(selectedGroupId as string, membershipId),
    onSuccess: () => {
      setMembershipActionError(null);
      queryClient.invalidateQueries({ queryKey: ["group", selectedGroupId] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["balances", selectedGroupId] });
    },
    onError: (error) => {
      setMembershipActionError(apiErrorMessage(error, "Could not remove member."));
    }
  });
  const updateGroupImage = useMutation({
    mutationFn: async (action: "change" | "remove") => {
      if (!selectedGroupId) {
        throw new Error("No group selected.");
      }
      if (action === "remove") {
        return apiClient.updateGroup(selectedGroupId, { imageAttachmentId: null });
      }
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Allow photo access to change the group logo.");
      }
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1]
      });
      if (picked.canceled || !picked.assets[0]) {
        return null;
      }
      const asset = picked.assets[0];
      const uploaded = await apiClient.uploadAttachment(
        {
          uri: asset.uri,
          name: asset.fileName ?? "group-image.jpg",
          type: asset.mimeType ?? "image/jpeg"
        },
        "group_image"
      );
      return apiClient.updateGroup(selectedGroupId, { imageAttachmentId: uploaded.id });
    },
    onSuccess: async (group) => {
      if (!group) {
        return;
      }
      if (group.imageUrl) {
        await clearAuthenticatedImageCache(group.imageUrl);
      }
      queryClient.invalidateQueries({ queryKey: ["group", selectedGroupId] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    }
  });
  const roleChange = useMutation({
    mutationFn: ({ membershipId, role }: { membershipId: string; role: MembershipRole }) => apiClient.updateMembershipRole(selectedGroupId as string, membershipId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["group", selectedGroupId] })
  });
  const lockExit = useMutation({
    mutationFn: (membershipId: string) => apiClient.lockMemberExit(selectedGroupId as string, membershipId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["group", selectedGroupId] })
  });
  const unlockExit = useMutation({
    mutationFn: (membershipId: string) => apiClient.unlockMemberExit(selectedGroupId as string, membershipId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["group", selectedGroupId] })
  });

  const addContacts = useMutation({
    mutationFn: async (contacts: SyncedContact[]) => {
      for (const contact of contacts) {
        await apiClient.addParticipant(selectedGroupId as string, contact.displayName, contact.phoneE164);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", selectedGroupId] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    }
  });

  async function openContactPicker() {
    setContactError(null);
    const granted = await hasContactsConsent();
    if (!granted) {
      showDialog({
        title: "Contacts are off",
        message: "Enable contacts in Settings → Contacts, then try again.",
        tone: "warning",
        primaryAction: {
          label: "Open settings",
          onPress: () => navigation.go("contactsSettings")
        },
        secondaryAction: { label: "Cancel", variant: "ghost" }
      });
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

  const group = groupQuery.data;
  const myMembership = group?.memberships.find((membership) => membership.userId === profileQuery.data?.id);
  const isOwner = myMembership?.role === "owner";
  const canEditGroup = isOwner || myMembership?.role === "admin";
  const activityItems = useMemo(
    () =>
      (activityQuery.data?.pages.flatMap((page) => page.items) ?? []).filter((row) =>
        isLedgerActivityEvent(row.activityType)
      ),
    [activityQuery.data]
  );
  const enrichedBalances = useMemo(() => {
    if (!group || !balancesQuery.data) {
      return [];
    }
    const lookups = buildGroupDisplayLookups(group);
    const activeIds = new Set(activeGroupParticipants(group).map((participant) => participant.id));
    return enrichBalanceRows(balancesQuery.data, lookups).filter((row) => {
      const known = activeIds.has(row.participantId) || Boolean(lookups.participantById.get(row.participantId)?.displayName);
      if (!known && row.balanceMinor === 0) {
        return false;
      }
      if (!row.displayName?.trim() || row.displayName === "Unknown participant") {
        if (row.balanceMinor === 0) {
          return false;
        }
        return true;
      }
      return true;
    }).map((row) =>
      row.displayName === "Unknown participant"
        ? { ...row, displayName: "Former member" }
        : row
    );
  }, [balancesQuery.data, group]);
  const myNetPositionMinor = useMemo(() => {
    if (!group) {
      return 0;
    }
    const myParticipantId = group.memberships.find((membership) => membership.userId === profileQuery.data?.id)?.participantId;
    if (myParticipantId && balancesQuery.data) {
      const row = enrichedBalances.find(
        (balance) => balance.participantId === myParticipantId && balance.currencyCode === (group.baseCurrencyCode || balance.currencyCode)
      );
      return row?.balanceMinor ?? 0;
    }
    return group.netBalanceMinor ?? 0;
  }, [balancesQuery.data, enrichedBalances, group, profileQuery.data?.id]);
  const enrichedActivity = useMemo(() => {
    if (!group || !activityItems.length) {
      return activityItems;
    }
    return enrichActivityRows(activityItems, buildGroupDisplayLookups(group), group.name);
  }, [activityItems, group]);
  const refreshing =
    groupsQuery.isRefetching ||
    groupQuery.isRefetching ||
    activityQuery.isRefetching ||
    balancesQuery.isRefetching ||
    expensesQuery.isRefetching;

  async function refreshScreen() {
    await Promise.all([
      groupsQuery.refetch(),
      selectedGroupId ? groupQuery.refetch() : Promise.resolve(),
      selectedGroupId ? activityQuery.refetch() : Promise.resolve(),
      selectedGroupId ? balancesQuery.refetch() : Promise.resolve(),
      selectedGroupId ? expensesQuery.refetch() : Promise.resolve()
    ]);
  }

  function confirmLeaveGroup() {
    setMembershipActionError(null);
    showDialog({
      title: "Leave group?",
      message: "You can leave only when your balance is settled.",
      tone: "warning",
      primaryAction: {
        label: "Leave",
        variant: "destructive",
        onPress: () => leaveGroup.mutate()
      },
      secondaryAction: { label: "Cancel", variant: "ghost" }
    });
  }

  function confirmRemoveMember(membershipId: string, displayName: string) {
    setMembershipActionError(null);
    showDialog({
      title: `Remove ${displayName}?`,
      message: "They can only be removed when their balance is settled.",
      tone: "warning",
      primaryAction: {
        label: "Remove",
        variant: "destructive",
        onPress: () => removeMember.mutate(membershipId)
      },
      secondaryAction: { label: "Cancel", variant: "ghost" }
    });
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refreshScreen()}>
      <Pressable onPress={() => navigation.go("groups")} style={styles.backRow} accessibilityRole="button" accessibilityLabel="Back to groups">
        <CaretLeft size={18} color={theme.colors.inkMuted} weight="bold" />
        <ThemedText variant="bodySm" tone="muted">
          Groups
        </ThemedText>
      </Pressable>

      <View style={styles.header}>
        <Pressable
          disabled={!canEditGroup || updateGroupImage.isPending}
          onPress={() => {
            if (!canEditGroup) {
              return;
            }
            setLogoSheetVisible(true);
          }}
        >
          <UserAvatar displayName={group?.name ?? "Group"} avatarUrl={group?.imageUrl} size={48} />
        </Pressable>
        <View style={styles.titleBlock}>
          <ThemedText variant="caption" tone="muted">
            Group ledger
          </ThemedText>
          <ThemedText variant="title">{group?.name ?? "Select group"}</ThemedText>
          {canEditGroup && !editingGroupName ? (
            <Pressable
              onPress={() => beginRenameGroup()}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Edit group name"
            >
              <ThemedText variant="caption" tone="confirmed">
                Edit name
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
        {group?.state === "archived" ? <StatusPill state="expired" /> : null}
      </View>
      {editingGroupName && canEditGroup ? (
        <DataSurface>
          <View style={styles.headerRename}>
            <InputField
              label="Group name"
              value={groupNameDraft}
              onChangeText={setGroupNameDraft}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                const next = groupNameDraft.trim();
                if (!next) {
                  setRenameError("Group name is required.");
                  return;
                }
                renameGroup.mutate(next);
              }}
            />
            {renameError ? <InlineNotice title="Rename failed" body={renameError} tone="owe" /> : null}
            <View style={styles.choiceButtons}>
              <Button
                label="Save name"
                size="compact"
                onPress={() => {
                  const next = groupNameDraft.trim();
                  if (!next) {
                    setRenameError("Group name is required.");
                    return;
                  }
                  renameGroup.mutate(next);
                }}
                loading={renameGroup.isPending}
                disabled={!groupNameDraft.trim()}
                style={styles.inlineButton}
              />
              <Button
                label="Cancel"
                size="compact"
                variant="secondary"
                onPress={() => {
                  setEditingGroupName(false);
                  setRenameError(null);
                }}
                disabled={renameGroup.isPending}
                style={styles.inlineButton}
              />
            </View>
          </View>
        </DataSurface>
      ) : null}

      {groupsQuery.data ? <GroupSelector groups={groupsQuery.data} selectedGroupId={selectedGroupId} onSelect={navigation.setSelectedGroupId} /> : null}
      {!selectedGroupId ? <EmptyState title="No group selected" body="Create or import a group before viewing activity." action={{ label: "Create group", onPress: () => navigation.go("groups") }} /> : null}
      {groupQuery.error ? <InlineNotice title="Group could not load" body={groupQuery.error.message} tone="owe" /> : null}

      {group ? (
        <>
          <DataSurface>
            <View style={styles.balanceStrip}>
              <View>
                <ThemedText variant="caption" tone="muted">
                  Base currency
                </ThemedText>
                <ThemedText variant="amount">{group.baseCurrencyCode}</ThemedText>
              </View>
              <View>
                <ThemedText variant="caption" tone="muted" align="right">
                  Net position
                </ThemedText>
                <ThemedText variant="amount" tone={myNetPositionMinor >= 0 ? "receive" : "owe"} align="right">
                  {formatSignedMoney(myNetPositionMinor, group.baseCurrencyCode)}
                </ThemedText>
              </View>
            </View>
            <View style={[styles.primaryRow, { borderTopColor: theme.colors.hairline }]}>
              <Button label="Settle" onPress={() => navigation.go("settlement")} style={styles.inlineButton} />
              <Button
                label="Add expense"
                variant="secondary"
                onPress={() => {
                  navigation.setSelectedExpenseId(undefined);
                  navigation.go("expense");
                }}
                style={styles.inlineButton}
              />
            </View>
          </DataSurface>

          <SegmentedControl
            value={tab}
            options={[
              { label: "Activity", value: "activity" },
              { label: "Balances", value: "balances" },
              { label: "Expenses", value: "expenses" },
              { label: "Charts", value: "charts" },
              { label: "People", value: "people" }
            ]}
            onChange={setTab}
          />

          {tab === "activity" ? (
            <View style={styles.section}>
              <SectionHeader title="Activity" action={<Button label="Audit" variant="ghost" onPress={() => navigation.go("audit")} />} />
              {activityQuery.error ? <InlineNotice title="Activity could not load" body={activityQuery.error.message} tone="owe" /> : null}
              {enrichedActivity.length ? (
                <>
                  <DataSurface>
                    {enrichedActivity.map((item) => (
                      <ActivityRow key={item.id} item={item} groupName={group.name} groupImageUrl={group.imageUrl} />
                    ))}
                  </DataSurface>
                  {activityQuery.hasNextPage ? (
                    <Button
                      label="Load more"
                      variant="secondary"
                      onPress={() => void activityQuery.fetchNextPage()}
                      loading={activityQuery.isFetchingNextPage}
                    />
                  ) : null}
                </>
              ) : (
                <EmptyState title="No activity" body="Recorded expenses and completed payments will appear here. UPI steps stay on Settle." />
              )}
            </View>
          ) : null}

          {tab === "balances" ? (
            <View style={styles.section}>
              <SectionHeader
                title="Balances"
                action={<Button label="Share" variant="ghost" onPress={() => shareBalanceSummary(group, enrichedBalances)} />}
              />
              {balancesQuery.error ? <InlineNotice title="Balances could not load" body={balancesQuery.error.message} tone="owe" /> : null}
              {enrichedBalances.length ? (
                <DataSurface>
                  {enrichedBalances.map((row) => (
                    <View key={`${row.participantId}-${row.currencyCode}`} style={[styles.dataRow, { borderBottomColor: theme.colors.hairline }]}>
                      <View style={styles.titleBlock}>
                        <ThemedText variant="bodyMedium">{row.displayName}</ThemedText>
                        <ThemedText variant="bodySm" tone="muted">
                          {row.balanceMinor >= 0 ? "Is owed by the group" : "Owes the group"}
                        </ThemedText>
                      </View>
                      <ThemedText variant="amount" tone={row.balanceMinor >= 0 ? "receive" : "owe"} align="right">
                        {formatSignedMoney(row.balanceMinor, row.currencyCode)}
                      </ThemedText>
                    </View>
                  ))}
                </DataSurface>
              ) : (
                <EmptyState title="No balances yet" body="Balances are server projections from accepted ledger events." />
              )}
            </View>
          ) : null}

          {tab === "expenses" ? (
            <View style={styles.section}>
              <SectionHeader
                title="Expenses"
                action={
                  <Button
                    label="Add"
                    variant="ghost"
                    onPress={() => {
                      navigation.setSelectedExpenseId(undefined);
                      navigation.go("expense");
                    }}
                  />
                }
              />
              {expensesQuery.error ? <InlineNotice title="Expenses could not load" body={expensesQuery.error.message} tone="owe" /> : null}
              {expensesQuery.data?.length ? (
                <DataSurface>
                  {expensesQuery.data.map((expense) => (
                    <View key={expense.id} style={[styles.dataRow, { borderBottomColor: theme.colors.hairline }]}>
                      <Pressable
                        onPress={() => {
                          setExpenseActionError(null);
                          setExpenseVoidReason("");
                          setExplainingExpenseId(expense.id);
                        }}
                        onLongPress={() => {
                          navigation.setSelectedExpenseId(expense.id);
                          navigation.go("audit");
                        }}
                        style={styles.expenseMain}
                      >
                        <View style={styles.titleBlock}>
                          <ThemedText variant="bodyMedium">{expense.description}</ThemedText>
                          <ThemedText variant="bodySm" tone="muted">
                            {expense.category || "Expense"} · v{expense.currentVersion}
                            {expense.notes ? " · has notes" : ""}
                          </ThemedText>
                        </View>
                        <View style={styles.trailing}>
                          <ThemedText variant="amount">{formatMoney(expense.totalAmountMinor, expense.currencyCode)}</ThemedText>
                          {expense.state === "voided" ? <StatusPill state="rejected" /> : null}
                        </View>
                      </Pressable>
                      {group.canManageExpenses && expense.state !== "voided" ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Edit ${expense.description}`}
                          hitSlop={8}
                          onPress={() => {
                            navigation.setSelectedExpenseId(expense.id);
                            navigation.go("expense");
                          }}
                          style={[styles.iconButton, { borderColor: theme.colors.confirmed }]}
                        >
                          <PencilSimple size={16} color={theme.colors.confirmed} weight="duotone" />
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </DataSurface>
              ) : (
                <EmptyState
                  title="No expenses yet"
                  body="Add equal, exact, shares, or itemized expenses with multiple payers."
                  action={{
                    label: "Add expense",
                    onPress: () => {
                      navigation.setSelectedExpenseId(undefined);
                      navigation.go("expense");
                    }
                  }}
                />
              )}
              {explainingExpenseId ? (
                <ExpenseExplanationSection
                  explanation={explanationQuery.data}
                  expense={expensesQuery.data?.find((row) => row.id === explainingExpenseId)}
                  history={expenseHistoryQuery.data}
                  historyLoading={expenseHistoryQuery.isLoading}
                  lookups={buildGroupDisplayLookups(group)}
                  loading={explanationQuery.isLoading}
                  error={explanationQuery.error instanceof Error ? explanationQuery.error.message : undefined}
                  canManage={Boolean(group.canManageExpenses)}
                  voidReason={expenseVoidReason}
                  onChangeVoidReason={setExpenseVoidReason}
                  actionError={expenseActionError}
                  voidPending={voidExpense.isPending}
                  onEdit={() => {
                    navigation.setSelectedExpenseId(explainingExpenseId);
                    navigation.go("expense");
                  }}
                  onHistory={() => {
                    navigation.setSelectedExpenseId(explainingExpenseId);
                    navigation.go("audit");
                  }}
                  onDelete={confirmVoidExpense}
                  onClose={() => {
                    setExplainingExpenseId(undefined);
                    setExpenseVoidReason("");
                    setExpenseActionError(null);
                  }}
                />
              ) : null}
            </View>
          ) : null}

          {tab === "charts" ? (
            <View style={styles.section}>
              <SectionHeader title="Reports" />
              <View style={styles.reportFilters}>
                {([30, 90, 180] as const).map((days) => (
                  <Pressable key={days} onPress={() => setReportDays(days)} style={[styles.reportFilter, { borderColor: reportDays === days ? theme.colors.confirmed : theme.colors.hairline }]}>
                    <ThemedText variant="caption" tone={reportDays === days ? "confirmed" : "muted"}>{days} days</ThemedText>
                  </Pressable>
                ))}
              </View>
              {monthlyReportQuery.error || contributionsReportQuery.error || settlementMethodsReportQuery.error || netPositionReportQuery.error ? (
                <InlineNotice title="Could not load reports" body="Try another date range or refresh the group." tone="owe" />
              ) : (
                <SpendingCharts
                  currencyCode={group.baseCurrencyCode || "INR"}
                  monthly={monthlyReportQuery.data?.items ?? []}
                  contributions={contributionsReportQuery.data?.items ?? []}
                  settlementMethods={settlementMethodsReportQuery.data?.items ?? []}
                  netPositions={netPositionReportQuery.data?.items ?? []}
                />
              )}
            </View>
          ) : null}

          {tab === "people" ? (
            <PeopleManagement
              group={group}
              canEditGroup={canEditGroup}
              isOwner={Boolean(isOwner)}
              inviteUrl={inviteUrl}
              newParticipantName={newParticipantName}
              newParticipantPhone={newParticipantPhone}
              setNewParticipantName={setNewParticipantName}
              setNewParticipantPhone={setNewParticipantPhone}
              addParticipant={() => addParticipant.mutate()}
              addParticipantPending={addParticipant.isPending}
              createInvite={() => createInvite.mutate()}
              createInvitePending={createInvite.isPending}
              archiveGroup={confirmDeleteGroup}
              archivePending={archiveGroup.isPending}
              unarchiveGroup={() => unarchiveGroup.mutate()}
              unarchivePending={unarchiveGroup.isPending}
              leaveGroup={confirmLeaveGroup}
              leavePending={leaveGroup.isPending}
              removeMember={confirmRemoveMember}
              removePending={removeMember.isPending}
              membershipActionError={membershipActionError}
              membersCanEditExpenses={group.membersCanEditExpenses !== false}
              setMembersCanEditExpenses={(value) => setMembersCanEditExpenses.mutate(value)}
              membersCanEditExpensesPending={setMembersCanEditExpenses.isPending}
              editingGroupName={editingGroupName}
              groupNameDraft={groupNameDraft}
              setGroupNameDraft={setGroupNameDraft}
              beginRenameGroup={() => beginRenameGroup({ openPeopleTab: true })}
              cancelRenameGroup={() => {
                setEditingGroupName(false);
                setRenameError(null);
              }}
              saveGroupName={() => {
                const next = groupNameDraft.trim();
                if (!next) {
                  setRenameError("Group name is required.");
                  return;
                }
                renameGroup.mutate(next);
              }}
              renamePending={renameGroup.isPending}
              renameError={renameError}
              roleChange={(membershipId, role) => roleChange.mutate({ membershipId, role })}
              lockExit={(membershipId) => lockExit.mutate(membershipId)}
              unlockExit={(membershipId) => unlockExit.mutate(membershipId)}
              onAddFromContacts={() => void openContactPicker()}
              contactError={contactError}
            />
          ) : null}
        </>
      ) : null}

      <ContactPicker
        visible={contactPickerVisible}
        contacts={availableContacts}
        loading={contactPickerLoading}
        onClose={() => setContactPickerVisible(false)}
        onConfirm={(selected) => addContacts.mutate(selected)}
      />

      <ActionSheet
        visible={logoSheetVisible}
        title="Group logo"
        message="Update how this group appears on home and activity."
        onClose={() => setLogoSheetVisible(false)}
        actions={[
          {
            key: "gallery",
            label: group?.imageUrl ? "Change photo" : "Add photo",
            subtitle: "Choose from your gallery",
            icon: <ImageSquare size={20} color={theme.colors.confirmed} weight="duotone" />,
            tone: "confirmed",
            disabled: updateGroupImage.isPending,
            onPress: () => updateGroupImage.mutate("change")
          },
          ...(group?.imageUrl
            ? [
                {
                  key: "remove",
                  label: "Remove photo",
                  subtitle: "Use group initials instead",
                  icon: <Trash size={20} color={theme.colors.owe} weight="duotone" />,
                  tone: "destructive" as const,
                  disabled: updateGroupImage.isPending,
                  onPress: () => updateGroupImage.mutate("remove")
                }
              ]
            : [])
        ]}
      />
    </Screen>
  );
}

function ExpenseExplanationSection({
  explanation,
  expense,
  history,
  historyLoading,
  lookups,
  loading,
  error,
  canManage,
  voidReason,
  onChangeVoidReason,
  actionError,
  voidPending,
  onEdit,
  onHistory,
  onDelete,
  onClose
}: {
  explanation?: ExpenseExplanation;
  expense?: { id: string; state: "active" | "voided"; currentVersion: number; notes?: string };
  history?: Array<{
    id: string;
    version: number;
    summary: string;
    reason?: string;
    changes?: Array<{ field: string; detail: string }>;
    actorName?: string;
    createdAt?: string;
  }>;
  historyLoading: boolean;
  lookups: ReturnType<typeof buildGroupDisplayLookups>;
  loading: boolean;
  error?: string;
  canManage: boolean;
  voidReason: string;
  onChangeVoidReason: (value: string) => void;
  actionError?: string | null;
  voidPending: boolean;
  onEdit: () => void;
  onHistory: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const nameFor = (participantId: string) => resolveParticipantDisplayName(participantId, lookups) ?? "Unknown participant";
  const isVoided = expense?.state === "voided";
  const notes = explanation?.notes ?? expense?.notes;
  const revisions = [...(history ?? [])].sort((left, right) => right.version - left.version);
  return (
    <View style={styles.section}>
      <SectionHeader title="Expense details" action={<Button label="Close" variant="ghost" onPress={onClose} />} />
      {loading ? <InlineNotice title="Loading expense" body="Reading the immutable expense snapshot." tone="pending" /> : null}
      {error ? <InlineNotice title="Explanation unavailable" body={error} tone="owe" /> : null}
      {explanation ? (
        <DataSurface>
          <View style={styles.explanationBlock}>
            {canManage && !isVoided ? (
              <Button label="Edit expense" onPress={onEdit} />
            ) : null}
            <ThemedText variant="bodyMedium">{explanation.explanation}</ThemedText>
            <ThemedText variant="bodySm" tone="muted">
              Snapshot version {explanation.snapshotVersion} · {explanation.splitMethod} split
            </ThemedText>
            {notes ? (
              <View style={[styles.explanationItem, { borderTopColor: theme.colors.hairline }]}>
                <ThemedText variant="caption" tone="muted">
                  Notes
                </ThemedText>
                <ThemedText variant="bodySm">{notes}</ThemedText>
              </View>
            ) : null}
            <ThemedText variant="caption" tone="muted">
              Paid
            </ThemedText>
            {explanation.paidBy.map((payer) => (
              <ThemedText key={payer.participantId} variant="bodySm">
                {nameFor(payer.participantId)}: {payer.formattedAmount}
              </ThemedText>
            ))}
            <ThemedText variant="caption" tone="muted">
              Owed
            </ThemedText>
            {explanation.owedBy.map((share) => (
              <ThemedText key={share.participantId} variant="bodySm">
                {nameFor(share.participantId)}: {share.formattedAmount} ({share.shareType})
              </ThemedText>
            ))}
            {explanation.itemizedDetail?.lineItems.map((item) => (
              <View key={`${item.label}-${item.amountMinor}`} style={[styles.explanationItem, { borderTopColor: theme.colors.hairline }]}>
                <ThemedText variant="bodySm">
                  {item.label}: {item.formattedAmount}
                </ThemedText>
                <ThemedText variant="caption" tone="muted">
                  Shared by {participantList(item.participantIds, lookups)}
                </ThemedText>
              </View>
            ))}

            <View style={[styles.explanationItem, { borderTopColor: theme.colors.hairline }]}>
              <ThemedText variant="bodyMedium">Version history</ThemedText>
              <ThemedText variant="caption" tone="muted">
                What changed between snapshot versions
              </ThemedText>
              {historyLoading ? <ThemedText variant="bodySm" tone="muted">Loading history…</ThemedText> : null}
              {!historyLoading && !revisions.length ? (
                <ThemedText variant="bodySm" tone="muted">
                  History is unavailable for this expense.
                </ThemedText>
              ) : null}
              {revisions.map((entry) => (
                <View key={entry.id} style={[styles.historyEntry, { borderTopColor: theme.colors.hairline }]}>
                  <ThemedText variant="bodySm">
                    v{entry.version} · {entry.summary}
                    {entry.actorName ? ` · ${entry.actorName}` : ""}
                  </ThemedText>
                  {entry.reason ? (
                    <ThemedText variant="caption" tone="muted">
                      Reason: {entry.reason}
                    </ThemedText>
                  ) : null}
                  {entry.changes?.map((change, index) => (
                    <ThemedText key={`${entry.id}-${change.field}-${index}`} variant="caption">
                      • {change.detail}
                    </ThemedText>
                  ))}
                </View>
              ))}
              <Button label="Open full audit" size="compact" variant="secondary" onPress={onHistory} />
            </View>

            {isVoided ? <InlineNotice title="Deleted expense" body="This expense was voided. See version history above for the audit trail." tone="owe" /> : null}
            {canManage && !isVoided ? (
              <>
                <InputField
                  label="Delete reason"
                  value={voidReason}
                  onChangeText={onChangeVoidReason}
                  placeholder="Wrong expense, duplicate, etc."
                />
                {actionError ? <InlineNotice title="Delete failed" body={actionError} tone="owe" /> : null}
                <Button
                  label="Delete expense"
                  size="compact"
                  variant="destructive"
                  onPress={onDelete}
                  loading={voidPending}
                  disabled={!voidReason.trim()}
                />
              </>
            ) : null}
          </View>
        </DataSurface>
      ) : null}
    </View>
  );
}

function PeopleManagement({
  group,
  canEditGroup,
  isOwner,
  inviteUrl,
  newParticipantName,
  newParticipantPhone,
  setNewParticipantName,
  setNewParticipantPhone,
  addParticipant,
  addParticipantPending,
  createInvite,
  createInvitePending,
  archiveGroup,
  archivePending,
  unarchiveGroup,
  unarchivePending,
  leaveGroup,
  leavePending,
  removeMember,
  removePending,
  membershipActionError,
  membersCanEditExpenses,
  setMembersCanEditExpenses,
  membersCanEditExpensesPending,
  editingGroupName,
  groupNameDraft,
  setGroupNameDraft,
  beginRenameGroup,
  cancelRenameGroup,
  saveGroupName,
  renamePending,
  renameError,
  roleChange,
  lockExit,
  unlockExit,
  onAddFromContacts,
  contactError
}: {
  group: GroupDetail;
  canEditGroup: boolean;
  isOwner: boolean;
  inviteUrl?: string;
  newParticipantName: string;
  newParticipantPhone: string;
  setNewParticipantName: (value: string) => void;
  setNewParticipantPhone: (value: string) => void;
  addParticipant: () => void;
  addParticipantPending: boolean;
  createInvite: () => void;
  createInvitePending: boolean;
  archiveGroup: () => void;
  archivePending: boolean;
  unarchiveGroup: () => void;
  unarchivePending: boolean;
  leaveGroup: () => void;
  leavePending: boolean;
  removeMember: (membershipId: string, displayName: string) => void;
  removePending: boolean;
  membershipActionError?: string | null;
  membersCanEditExpenses: boolean;
  setMembersCanEditExpenses: (value: boolean) => void;
  membersCanEditExpensesPending: boolean;
  editingGroupName: boolean;
  groupNameDraft: string;
  setGroupNameDraft: (value: string) => void;
  beginRenameGroup: () => void;
  cancelRenameGroup: () => void;
  saveGroupName: () => void;
  renamePending: boolean;
  renameError: string | null;
  roleChange: (membershipId: string, role: MembershipRole) => void;
  lockExit: (membershipId: string) => void;
  unlockExit: (membershipId: string) => void;
  onAddFromContacts: () => void;
  contactError?: string | null;
}) {
  const theme = useTheme();
  const lookups = buildGroupDisplayLookups(group);
  const isArchived = group.state === "archived";

  return (
    <View style={styles.section}>
      <SectionHeader title="People and roles" />

      {canEditGroup ? (
        <DataSurface>
          <View style={styles.formBlock}>
            <ThemedText variant="bodyMedium">Group name</ThemedText>
            {editingGroupName ? (
              <>
                <InputField label="Name" value={groupNameDraft} onChangeText={setGroupNameDraft} />
                {renameError ? <InlineNotice title="Rename failed" body={renameError} tone="owe" /> : null}
                <View style={styles.choiceButtons}>
                  <Button label="Save name" onPress={saveGroupName} loading={renamePending} disabled={!groupNameDraft.trim()} style={styles.inlineButton} />
                  <Button label="Cancel" variant="secondary" onPress={cancelRenameGroup} disabled={renamePending} style={styles.inlineButton} />
                </View>
              </>
            ) : (
              <>
                <ThemedText variant="title">{group.name}</ThemedText>
                <Button label="Edit group name" variant="secondary" onPress={beginRenameGroup} />
              </>
            )}
            <SettingsToggleRow
              label="Members can edit expenses"
              subtitle="Turn off to restrict edit and delete to owners and admins only."
              value={membersCanEditExpenses}
              onValueChange={setMembersCanEditExpenses}
              disabled={membersCanEditExpensesPending}
            />
          </View>
        </DataSurface>
      ) : null}

      <DataSurface>
        {activeGroupMemberships(group).map((membership) => {
          const displayName = resolveParticipantDisplayName(membership.participantId, lookups) ?? "Member";
          const isLocked = membership.status === "locked_for_exit" || membership.status === "inactive_locked";
          const canRemove = canEditGroup && membership.role !== "owner" && membership.status === "active";
          return (
            <View key={membership.id} style={[styles.personRow, { borderBottomColor: theme.colors.hairline }]}>
              <View style={styles.titleBlock}>
                <ThemedText variant="bodyMedium">{displayName}</ThemedText>
                <ThemedText variant="bodySm" tone="muted">
                  {membership.role} - {membership.status}
                </ThemedText>
              </View>
              <View style={styles.roleButtons}>
                {canEditGroup
                  ? (["admin", "member", "viewer"] as MembershipRole[]).map((role) => (
                      <Pressable key={role} onPress={() => roleChange(membership.id, role)} style={[styles.roleChip, { borderColor: theme.colors.hairline, borderRadius: theme.radius.sm }]}>
                        <ThemedText variant="caption" tone={membership.role === role ? "confirmed" : "muted"}>
                          {role}
                        </ThemedText>
                      </Pressable>
                    ))
                  : null}
                {canEditGroup && membership.role !== "owner" && membership.status === "active" ? (
                  <Pressable
                    onPress={() => lockExit(membership.id)}
                    accessibilityLabel={`Lock exit for ${displayName}`}
                    style={[styles.iconButton, { borderColor: theme.colors.hairline }]}
                  >
                    <LockKey size={16} color={theme.colors.inkMuted} weight="duotone" />
                  </Pressable>
                ) : null}
                {canEditGroup && membership.role !== "owner" && isLocked ? (
                  <Pressable
                    onPress={() => unlockExit(membership.id)}
                    accessibilityLabel={`Unlock exit for ${displayName}`}
                    style={[styles.iconButton, { borderColor: theme.colors.confirmed }]}
                  >
                    <LockKeyOpen size={16} color={theme.colors.confirmed} weight="duotone" />
                  </Pressable>
                ) : null}
                {canRemove ? (
                  <Pressable
                    onPress={() => removeMember(membership.id, displayName)}
                    accessibilityLabel={`Remove ${displayName}`}
                    disabled={removePending}
                    style={[styles.iconButton, { borderColor: theme.colors.owe }]}
                  >
                    <UserMinus size={16} color={theme.colors.owe} weight="duotone" />
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
      </DataSurface>

      {canEditGroup ? (
        <DataSurface>
          <View style={styles.formBlock}>
            <View style={styles.formHeader}>
              <UserPlus size={20} color={theme.colors.inkMuted} weight="duotone" />
              <ThemedText variant="bodyMedium">Add manual or guest participant</ThemedText>
            </View> 
            <InputField label="Name" value={newParticipantName} onChangeText={setNewParticipantName} />
            <InputField label="Phone optional" value={newParticipantPhone} onChangeText={setNewParticipantPhone} keyboardType="phone-pad" />
            <Button label="Add participant" variant="secondary" onPress={addParticipant} loading={addParticipantPending} disabled={!newParticipantName.trim()} />
            <Button label="Add from contacts" variant="secondary" onPress={onAddFromContacts} />
          </View>
        </DataSurface>
      ) : null}

      {contactError ? <InlineNotice title="Contacts unavailable" body={contactError} tone="owe" /> : null}
      {membershipActionError ? <InlineNotice title="Membership action failed" body={membershipActionError} tone="owe" /> : null}

      {canEditGroup ? (
        <DataSurface>
          <View style={styles.formBlock}>
            <View style={styles.formHeader}>
              <LinkSimple size={20} color={theme.colors.inkMuted} weight="duotone" />
              <ThemedText variant="bodyMedium">Invite link</ThemedText>
            </View>
            {inviteUrl ? (
              <View style={styles.inviteBlock}>
                <ThemedText variant="bodySm" tone="confirmed">
                  {inviteUrl}
                </ThemedText>
                <View style={[styles.qrBox, { backgroundColor: theme.colors.ink, borderRadius: theme.radius.sm }]}>
                  <QRCode value={inviteUrl} size={116} backgroundColor="transparent" color={theme.colors.canvas} />
                </View>
                <Button label="Share invite" variant="secondary" onPress={() => Share.share({ message: `Join ${group.name} on SplitSaathi: ${inviteUrl}` })} />
              </View>
            ) : (
              <ThemedText variant="bodySm" tone="muted">
                Generate a link for WhatsApp, SMS, or QR sharing.
              </ThemedText>
            )}
            <Button label="Generate invite" variant="secondary" onPress={createInvite} loading={createInvitePending} />
          </View>
        </DataSurface>
      ) : null}

      {!isOwner ? (
        <Button label="Leave group" variant="destructive" onPress={leaveGroup} loading={leavePending} />
      ) : null}

      {canEditGroup ? (
        isArchived ? (
          <>
            <Button label="Restore group" onPress={unarchiveGroup} loading={unarchivePending} />
            <InlineNotice title="Group is deleted" body="Restore it to allow new expenses and settlements again." tone="pending" />
          </>
        ) : (
          <>
            <Button label="Delete group" variant="destructive" onPress={archiveGroup} loading={archivePending} />
            <InlineNotice
              title="Deletes from your active list"
              body="History stays available for audit and exports. You can restore the group later."
              tone="pending"
            />
          </>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  titleBlock: {
    flex: 1,
    gap: 4
  },
  headerRename: {
    gap: 12,
    padding: 14
  },
  expenseMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  historyEntry: {
    gap: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  balanceStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    gap: 12
  },
  primaryRow: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderTopWidth: 1
  },
  inlineButton: {
    flex: 1
  },
  choiceButtons: {
    flexDirection: "row",
    gap: 10
  },
  section: {
    gap: 12
  },
  reportFilters: {
    flexDirection: "row",
    gap: 8
  },
  reportFilter: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  dataRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderBottomWidth: 1,
    gap: 12
  },
  trailing: {
    alignItems: "flex-end",
    gap: 6
  },
  explanationBlock: {
    padding: 14,
    gap: 8
  },
  explanationItem: {
    paddingTop: 8,
    gap: 3,
    borderTopWidth: 1
  },
  personRow: {
    padding: 14,
    borderBottomWidth: 1,
    gap: 12
  },
  roleButtons: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8
  },
  roleChip: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
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
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  logoActions: {
    flex: 1,
    gap: 8
  },
  inviteBlock: {
    gap: 12,
    alignItems: "flex-start"
  },
  qrBox: {
    padding: 10
  }
});

async function shareBalanceSummary(group: GroupDetail, balances: Array<{ displayName: string; balanceMinor: number; currencyCode: string }>) {
  const lines = balances.length
    ? balances.map((row) => `${row.displayName}: ${formatSignedMoney(row.balanceMinor, row.currencyCode)}`)
    : ["All balances are settled."];
  await Share.share({
    message: [`SplitSaathi balance summary for ${group.name}`, ...lines].join("\n")
  });
}
