import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AddressBook,
  CaretDown,
  CaretRight,
  ChartBar,
  ClockCountdown,
  Copy,
  DotsThreeVertical,
  DownloadSimple,
  Handshake,
  ImageSquare,
  LinkSimple,
  LockKey,
  LockKeyOpen,
  PencilSimple,
  PlusCircle,
  QrCode,
  Scales,
  ShareNetwork,
  ShieldCheck,
  Trash,
  UploadSimple,
  UserMinus,
  UsersThree,
  Wallet
} from "phosphor-react-native";
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
import { GroupTypeAvatar } from "../components/GroupTypeAvatar";
import { InlineNotice } from "../components/InlineNotice";
import { QRScannerModal } from "../components/QRScannerModal";
import { ANALYTICS_PERIODS, AnalyticsPeriod, SpendingCharts } from "../components/SpendingCharts";
import { InputField } from "../components/InputField";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionHeader } from "../components/SectionHeader";
import { SegmentedControl } from "../components/SegmentedControl";
import { StatusPill } from "../components/StatusPill";
import { ThemedText } from "../components/ThemedText";
import { UserAvatar } from "../components/UserAvatar";
import { colorWithAlpha, useTheme } from "../theme";
import { ExpenseExplanation, GroupDetail, GroupType, MembershipRole } from "../types/domain";
import { AppNavigation } from "../types/navigation";
import { formatMoney, formatSignedMoney } from "../utils/money";
import { buildGroupDisplayLookups, enrichActivityRows, enrichBalanceRows, participantList, replaceParticipantIds, resolveActorDisplayName, resolveParticipantDisplayName } from "../utils/displayNames";
import { activeGroupMemberships, activeGroupParticipants } from "../utils/groupPeople";
import { formatExpenseListDate, getExpenseCategoryDisplay } from "../utils/expenseCategoryDisplay";
import { isLedgerActivityEvent } from "../utils/activityFeed";
import { ensureContactsAccess, openSystemSettings, syncDeviceContacts, type SyncedContact } from "../utils/contactDiscovery";
import { ensureMediaLibraryPermission } from "../utils/mediaPermissions";
import { clearAuthenticatedImageCache } from "../utils/authenticatedImage";
import { participantColor } from "../utils/participantColor";

import { copyText } from "../utils/clipboard";

type GroupTab = "activity" | "balances" | "expenses" | "charts" | "people";
const ACTIVITY_PAGE_SIZE = 5;
const ACTIVITY_PREVIEW_COUNT = 5;

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
  const [inviteUrl, setInviteUrl] = useState<string>();
  const [inviteCode, setInviteCode] = useState<string>();
  const [contactPickerVisible, setContactPickerVisible] = useState(false);
  const [contactPickerLoading, setContactPickerLoading] = useState(false);
  const [availableContacts, setAvailableContacts] = useState<SyncedContact[]>([]);
  const [contactError, setContactError] = useState<string | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>("monthly");
  const [logoSheetVisible, setLogoSheetVisible] = useState(false);
  const [menuSheetVisible, setMenuSheetVisible] = useState(false);
  const [tabsOffsetY, setTabsOffsetY] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [membershipActionError, setMembershipActionError] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [expenseVoidReason, setExpenseVoidReason] = useState("");
  const [expenseActionError, setExpenseActionError] = useState<string | null>(null);

  const groupsQuery = useQuery({ queryKey: ["groups"], queryFn: () => apiClient.listGroups() });
  const profileQuery = useQuery({ queryKey: ["me"], queryFn: () => apiClient.getMe() });
  const selectedGroupId = navigation.selectedGroupId ?? groupsQuery.data?.[0]?.id;

  useEffect(() => {
    setShowAllActivity(false);
  }, [selectedGroupId]);

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
  const reportDays = ANALYTICS_PERIODS.find((item) => item.value === analyticsPeriod)?.days ?? 30;
  const reportRange = useMemo(() => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(to.getDate() - reportDays + 1);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }, [reportDays]);
  const chartExpenses = useMemo(() => {
    const expenses = expensesQuery.data ?? [];
    const fromMs = new Date(`${reportRange.from}T00:00:00`).getTime();
    const toMs = new Date(`${reportRange.to}T23:59:59`).getTime();
    return expenses.filter((expense) => {
      const stamp = new Date(expense.expenseDate).getTime();
      return stamp >= fromMs && stamp <= toMs;
    });
  }, [expensesQuery.data, reportRange.from, reportRange.to]);
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

  const createInvite = useMutation({
    mutationFn: () => apiClient.createInvite(selectedGroupId as string),
    onSuccess: (response) => {
      setInviteUrl(response.inviteUrl);
      if (response.code) setInviteCode(response.code);
    }
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
      focusTab("people");
    }
  }

  function focusTab(nextTab: GroupTab) {
    setTab(nextTab);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, tabsOffsetY - 8), animated: true });
    });
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
      queryClient.invalidateQueries({ queryKey: ["friends"] });
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
      const granted = await ensureMediaLibraryPermission();
      if (!granted) {
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
        await apiClient.addParticipant(
          selectedGroupId as string,
          contact.displayName,
          contact.phoneE164,
          contact.matchedUserId ?? undefined
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", selectedGroupId] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    }
  });

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
      const result = await syncDeviceContacts({ skipPermissionCheck: true });
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
  const visibleActivity = showAllActivity ? enrichedActivity : enrichedActivity.slice(0, ACTIVITY_PREVIEW_COUNT);
  const canSeeAllActivity =
    !showAllActivity && (enrichedActivity.length > ACTIVITY_PREVIEW_COUNT || Boolean(activityQuery.hasNextPage));
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
    <Screen scrollRef={scrollRef} refreshing={refreshing} onRefresh={() => void refreshScreen()}>
      <ScreenHeader
        navigation={navigation}
        fallbackRoute="groups"
        trailing={
          <Pressable
            onPress={() => setMenuSheetVisible(true)}
            style={[styles.navIconButton, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.hairline }]}
            accessibilityRole="button"
            accessibilityLabel="Group options"
          >
            <DotsThreeVertical size={18} color={theme.colors.ink} weight="bold" />
          </Pressable>
        }
      />

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
          <UserAvatar
            displayName={group?.name ?? "Group"}
            avatarUrl={group?.imageUrl}
            size={64}
            accentColor={theme.colors.confirmed}
          />
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
              style={styles.editName}
            >
              <PencilSimple size={14} color={theme.colors.confirmed} weight="duotone" />
              <ThemedText variant="caption" tone="confirmed">
                Edit name
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
        {group?.state === "archived" ? <StatusPill state="expired" /> : null}
      </View>
      {editingGroupName && canEditGroup ? (
        <DataSurface elevated>
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

      {!selectedGroupId ? <EmptyState title="No group selected" body="Create or import a group before viewing activity." action={{ label: "Create group", onPress: () => navigation.go("groups") }} /> : null}
      {groupQuery.error ? <InlineNotice title="Group could not load" body={groupQuery.error.message} tone="owe" /> : null}

      {group ? (
        <>
          {enrichedBalances.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryRow}>
              {enrichedBalances.map((row) => {
                const accent = participantColor(row.participantId);
                const tone = row.balanceMinor >= 0 ? "receive" : "owe";
                const caption =
                  row.balanceMinor > 0 ? "You will get back" : row.balanceMinor < 0 ? "You owe" : "Settled up";
                return (
                  <Pressable
                    key={`${row.participantId}-${row.currencyCode}`}
                    onPress={() => setTab("balances")}
                    style={[
                      styles.summaryCard,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.hairline,
                        borderRadius: theme.radius.md,
                        borderWidth: theme.mode === "light" ? 0 : 1
                      },
                      theme.cardShadow
                    ]}
                  >
                    <View style={[styles.summaryIcon, { backgroundColor: colorWithAlpha(accent, theme.mode === "dark" ? 0.22 : 0.14) }]}>
                      <UsersThree size={16} color={accent} weight="duotone" />
                    </View>
                    <ThemedText variant="bodyMedium" numberOfLines={1}>
                      {row.displayName}
                    </ThemedText>
                    <ThemedText variant="amountSm" tone={tone}>
                      {formatSignedMoney(row.balanceMinor, row.currencyCode)}
                    </ThemedText>
                    <View style={styles.summaryFooter}>
                      <ThemedText variant="caption" tone="muted" numberOfLines={1} style={styles.summaryCaption}>
                        {caption}
                      </ThemedText>
                      <CaretRight size={14} color={theme.colors.inkFaint} weight="bold" />
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          <DataSurface elevated>
            <View style={styles.balanceStrip}>
              <View style={styles.currencyBlock}>
                <ThemedText variant="caption" tone="muted">
                  Base currency
                </ThemedText>
                <View style={styles.currencyValue}>
                  <ThemedText variant="amount">{group.baseCurrencyCode}</ThemedText>
                  <CaretDown size={14} color={theme.colors.inkMuted} weight="bold" />
                </View>
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
              <Button label="Settle" Icon={Handshake} onPress={() => navigation.go("settlement")} style={styles.inlineButton} />
              <Button
                label="Add expense"
                variant="secondary"
                Icon={PlusCircle}
                onPress={() => {
                  navigation.setSelectedExpenseId(undefined);
                  navigation.go("expense");
                }}
                style={styles.inlineButton}
              />
            </View>
          </DataSurface>

          <View onLayout={(event) => setTabsOffsetY(event.nativeEvent.layout.y)}>
            <SegmentedControl
              value={tab}
              options={[
                { label: "Activity", value: "activity", Icon: ClockCountdown },
                { label: "Balances", value: "balances", Icon: Scales },
                { label: "Expenses", value: "expenses", Icon: Wallet },
                { label: "Charts", value: "charts", Icon: ChartBar },
                { label: "People", value: "people", Icon: UsersThree }
              ]}
              onChange={setTab}
            />
          </View>

          {tab === "activity" ? (
            <View style={styles.section}>
              <SectionHeader
                title="Activity"
                action={
                  <Pressable onPress={() => navigation.go("audit")} style={styles.auditLink} hitSlop={8}>
                    <ClockCountdown size={14} color={theme.colors.confirmed} weight="duotone" />
                    <ThemedText variant="caption" tone="confirmed">
                      Audit log
                    </ThemedText>
                  </Pressable>
                }
              />
              {activityQuery.error ? <InlineNotice title="Activity could not load" body={activityQuery.error.message} tone="owe" /> : null}
              {enrichedActivity.length ? (
                <>
                  <DataSurface elevated>
                    {visibleActivity.map((item) => (
                      <ActivityRow key={item.id} item={item} groupName={group.name} groupImageUrl={group.imageUrl} />
                    ))}
                  </DataSurface>
                  {canSeeAllActivity ? (
                    <Pressable
                      onPress={() => {
                        setShowAllActivity(true);
                        if (activityQuery.hasNextPage) {
                          void activityQuery.fetchNextPage();
                        }
                      }}
                      style={[
                        styles.seeAllButton,
                        {
                          borderColor: theme.colors.hairline,
                          backgroundColor: colorWithAlpha(theme.colors.info, theme.mode === "dark" ? 0.16 : 0.08)
                        }
                      ]}
                    >
                      <ThemedText variant="bodySm" style={{ color: theme.colors.info, fontWeight: "600" }}>
                        See all ({enrichedActivity.length})
                      </ThemedText>
                      <CaretDown size={14} color={theme.colors.info} />
                    </Pressable>
                  ) : null}
                  {showAllActivity ? (
                    <Pressable
                      onPress={() => {
                        if (activityQuery.hasNextPage) {
                          void activityQuery.fetchNextPage();
                        } else {
                          setShowAllActivity(false);
                        }
                      }}
                      style={[
                        styles.seeAllButton,
                        {
                          borderColor: theme.colors.hairline,
                          backgroundColor: colorWithAlpha(theme.colors.info, theme.mode === "dark" ? 0.16 : 0.08),
                          marginTop: 8
                        }
                      ]}
                    >
                      <ThemedText variant="bodySm" style={{ color: theme.colors.info, fontWeight: "600" }}>
                        {activityQuery.hasNextPage ? "Load more events" : "Show less"}
                      </ThemedText>
                      <CaretDown
                        size={14}
                        color={theme.colors.info}
                        style={{ transform: [{ rotate: activityQuery.hasNextPage ? "0deg" : "180deg" }] }}
                      />
                    </Pressable>
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
                <DataSurface elevated>
                  {expensesQuery.data.map((expense, index) => {
                    const categoryDisplay = getExpenseCategoryDisplay(expense.category);
                    const metaParts = [
                      categoryDisplay.label,
                      formatExpenseListDate(expense.expenseDate)
                    ];
                    if (expense.notes?.trim()) {
                      metaParts.push("Notes");
                    }

                    return (
                      <View
                        key={expense.id}
                        style={[
                          styles.expenseRow,
                          {
                            borderBottomColor: theme.colors.hairline,
                            borderBottomWidth: index < expensesQuery.data!.length - 1 ? 1 : 0
                          }
                        ]}
                      >
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
                          style={styles.expenseRowMain}
                        >
                          <ExpenseRowAvatar
                            category={expense.category}
                            groupType={group.groupType}
                            groupImageUrl={group.imageUrl}
                            groupName={group.name}
                          />
                          <View style={styles.expenseCopy}>
                            <ThemedText variant="bodyMedium" numberOfLines={1}>
                              {expense.description}
                            </ThemedText>
                            <ThemedText variant="bodySm" tone="muted" numberOfLines={1}>
                              {metaParts.join(" · ")}
                            </ThemedText>
                          </View>
                          <View style={styles.expenseTrailing}>
                            <ThemedText variant="amountSm" align="right">
                              {formatMoney(expense.totalAmountMinor, expense.currencyCode)}
                            </ThemedText>
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
                            style={[
                              styles.expenseEditButton,
                              {
                                borderColor: colorWithAlpha(theme.colors.confirmed, 0.35),
                                backgroundColor: colorWithAlpha(theme.colors.confirmed, theme.mode === "dark" ? 0.12 : 0.08)
                              }
                            ]}
                          >
                            <PencilSimple size={16} color={theme.colors.confirmed} weight="duotone" />
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })}
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
              {monthlyReportQuery.error || contributionsReportQuery.error || settlementMethodsReportQuery.error || netPositionReportQuery.error ? (
                <InlineNotice title="Could not load reports" body="Try another date range or refresh the group." tone="owe" />
              ) : (
                <SpendingCharts
                  currencyCode={group.baseCurrencyCode || "INR"}
                  period={analyticsPeriod}
                  onPeriodChange={setAnalyticsPeriod}
                  monthly={monthlyReportQuery.data?.items ?? []}
                  contributions={contributionsReportQuery.data?.items ?? []}
                  settlementMethods={settlementMethodsReportQuery.data?.items ?? []}
                  netPositions={netPositionReportQuery.data?.items ?? []}
                  expenses={chartExpenses}
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
              inviteCode={inviteCode}
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
            defer: true,
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
                  defer: true,
                  onPress: () => updateGroupImage.mutate("remove")
                }
              ]
            : [])
        ]}
      />

      <ActionSheet
        visible={menuSheetVisible}
        title="Group options"
        onClose={() => setMenuSheetVisible(false)}
        toggles={
          canEditGroup && group
            ? [
                {
                  key: "membersEdit",
                  label: "Members can edit expenses",
                  subtitle: "Turn off to restrict edit and delete to owners and admins only.",
                  value: group.membersCanEditExpenses !== false,
                  disabled: setMembersCanEditExpenses.isPending,
                  onValueChange: (value) => setMembersCanEditExpenses.mutate(value)
                }
              ]
            : undefined
        }
        actions={[
          ...(canEditGroup
            ? [
                {
                  key: "logo",
                  label: "Group logo",
                  subtitle: "Change or remove photo",
                  icon: <ImageSquare size={20} color={theme.colors.confirmed} weight="duotone" />,
                  tone: "confirmed" as const,
                  defer: true,
                  onPress: () => setLogoSheetVisible(true)
                },
                {
                  key: "rename",
                  label: "Edit name",
                  icon: <PencilSimple size={20} color={theme.colors.confirmed} weight="duotone" />,
                  tone: "confirmed" as const,
                  onPress: () => beginRenameGroup()
                }
              ]
            : []),
          {
            key: "audit",
            label: "Audit log",
            icon: <ClockCountdown size={20} color={theme.colors.confirmed} weight="duotone" />,
            tone: "confirmed",
            onPress: () => navigation.go("audit")
          },
          ...(group
            ? [
                {
                  key: "share",
                  label: "Share balances",
                  icon: <LinkSimple size={20} color={theme.colors.info} weight="duotone" />,
                  onPress: () => void shareBalanceSummary(group, enrichedBalances)
                }
              ]
            : []),
          {
            key: "people",
            label: "People",
            icon: <UsersThree size={20} color={theme.colors.info} weight="duotone" />,
            onPress: () => focusTab("people")
          }
        ]}
      />
    </Screen>
  );
}

function ExpenseRowAvatar({
  category,
  groupType,
  groupImageUrl,
  groupName
}: {
  category?: string;
  groupType?: GroupType;
  groupImageUrl?: string | null;
  groupName: string;
}) {
  const theme = useTheme();
  const categoryDisplay = getExpenseCategoryDisplay(category);

  if (!category?.trim() && groupImageUrl) {
    return <UserAvatar displayName={groupName} avatarUrl={groupImageUrl} size={44} />;
  }

  if (!category?.trim()) {
    return <GroupTypeAvatar groupType={groupType} imageUrl={groupImageUrl} size={44} />;
  }

  const Icon = categoryDisplay.Icon;
  return (
    <View
      style={[
        styles.expenseCategoryAvatar,
        {
          backgroundColor: colorWithAlpha(categoryDisplay.tint, theme.mode === "dark" ? 0.22 : 0.14),
          borderColor: colorWithAlpha(categoryDisplay.tint, 0.22)
        }
      ]}
    >
      <Icon size={21} color={categoryDisplay.tint} weight="duotone" />
    </View>
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
    actorId?: string;
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
              {revisions.map((entry) => {
                const actorLabel =
                  resolveActorDisplayName(entry.actorId, lookups) ?? entry.actorName;
                return (
                <View key={entry.id} style={[styles.historyEntry, { borderTopColor: theme.colors.hairline }]}>
                  <ThemedText variant="bodySm">
                    v{entry.version} · {entry.summary}
                    {actorLabel ? ` · ${actorLabel}` : ""}
                  </ThemedText>
                  {entry.reason ? (
                    <ThemedText variant="caption" tone="muted">
                      Reason: {replaceParticipantIds(entry.reason, lookups)}
                    </ThemedText>
                  ) : null}
                  {entry.changes?.map((change, index) => (
                    <ThemedText key={`${entry.id}-${change.field}-${index}`} variant="caption">
                      • {replaceParticipantIds(change.detail, lookups)}
                    </ThemedText>
                  ))}
                </View>
                );
              })}
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
  inviteCode,
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
  inviteCode?: string;
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
        <View style={{ gap: 14 }}>
          {/* Card 1: Invite people main card */}
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 20,
              borderWidth: 1,
              borderColor: theme.colors.hairline,
              padding: 16,
              gap: 14
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#E6F7F5", alignItems: "center", justifyContent: "center" }}>
                  <UsersThree size={22} color="#0D9488" weight="duotone" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText variant="title" style={{ fontSize: 18, fontWeight: "700" }}>
                    Invite people
                  </ThemedText>
                  <ThemedText variant="bodySm" tone="muted" style={{ fontSize: 12, lineHeight: 16 }}>
                    Add contacts with a phone number, or share a link / QR for others to join.
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Add from contacts pill button */}
            <Pressable
              onPress={onAddFromContacts}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderRadius: 14,
                backgroundColor: "#E6F7F5",
                borderWidth: 1,
                borderColor: "#CCFBF1"
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <AddressBook size={20} color="#0D9488" weight="duotone" />
                <ThemedText variant="bodyMedium" style={{ color: "#0D9488", fontWeight: "700" }}>
                  Add from contacts
                </ThemedText>
              </View>
              <CaretRight size={18} color="#0D9488" />
            </Pressable>

            {/* Create new link + Share row */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={createInvite}
                disabled={createInvitePending}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 12,
                  paddingHorizontal: 8,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: "#818CF8",
                  backgroundColor: "#FFFFFF"
                }}
              >
                <LinkSimple size={18} color="#4F46E5" weight="bold" />
                <ThemedText variant="bodySm" style={{ color: "#4F46E5", fontWeight: "700" }}>
                  {createInvitePending ? "Loading..." : "Create new link"}
                </ThemedText>
              </Pressable>

              {inviteUrl ? (
                <Pressable
                  onPress={() => Share.share({ message: `Join ${group.name} on SplitSaathi: ${inviteUrl}` })}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: theme.colors.hairline,
                    backgroundColor: "#FFFFFF"
                  }}
                >
                  <UploadSimple size={18} color={theme.colors.ink} weight="bold" />
                  <ThemedText variant="bodySm" style={{ fontWeight: "700" }}>
                    Share
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Card 2: GROUP CODE Card (Sleek Compact Mint Container) */}
          {inviteCode ? (
            <View
              style={{
                backgroundColor: "#E6F7F5",
                borderColor: "#99F6E4",
                borderWidth: 1,
                borderRadius: 16,
                paddingHorizontal: 14,
                paddingVertical: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: "#FFFFFF",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: "#CCFBF1"
                  }}
                >
                  <ShieldCheck size={20} color="#0D9488" weight="duotone" />
                </View>
                <View style={{ gap: 1, flex: 1 }}>
                  <ThemedText variant="caption" style={{ color: "#64748B", letterSpacing: 0.8, fontWeight: "700", fontSize: 10 }}>
                    GROUP CODE
                  </ThemedText>
                  <ThemedText variant="title" style={{ fontSize: 20, fontWeight: "800", color: "#0D9488", letterSpacing: 2 }} selectable>
                    {inviteCode}
                  </ThemedText>
                  <ThemedText variant="caption" style={{ color: "#64748B", fontSize: 11 }}>
                    Friends can enter this 6-character code in Join Group
                  </ThemedText>
                </View>
              </View>

              {/* Icon-only Copy Button */}
              <Pressable
                onPress={() => copyText(inviteCode)}
                accessibilityLabel="Copy group code"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1,
                  borderColor: "#99F6E4",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Copy size={18} color="#0D9488" weight="duotone" />
              </Pressable>
            </View>
          ) : null}

          {/* Card 3: Invite link Card */}
          {inviteUrl ? (
            <View
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: theme.colors.hairline,
                borderWidth: 1,
                borderRadius: 16,
                paddingHorizontal: 14,
                paddingVertical: 12,
                gap: 12
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: "#E6F7F5",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <LinkSimple size={18} color="#0D9488" weight="duotone" />
                  </View>
                  <View style={{ gap: 1, flex: 1 }}>
                    <ThemedText variant="bodyMedium" style={{ fontWeight: "700", fontSize: 14 }}>
                      Invite link
                    </ThemedText>
                    <ThemedText variant="bodySm" style={{ color: "#0D9488", fontWeight: "600" }} numberOfLines={1} selectable>
                      {inviteUrl}
                    </ThemedText>
                  </View>
                </View>

                {/* Icon-only Copy Button */}
                <Pressable
                  onPress={() => copyText(inviteUrl)}
                  accessibilityLabel="Copy invite link"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: "#E6F7F5",
                    borderWidth: 1,
                    borderColor: "#99F6E4",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Copy size={18} color="#0D9488" weight="duotone" />
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* Card 4: Scan to join QR Code Card */}
          {inviteUrl ? (
            <View
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: theme.colors.hairline,
                borderWidth: 1,
                borderRadius: 20,
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16
              }}
            >
              <View style={{ flex: 1, gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: "#E6F7F5",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <QrCode size={20} color="#0D9488" weight="duotone" />
                  </View>
                  <ThemedText variant="bodyMedium" style={{ fontWeight: "700", fontSize: 16 }}>
                    Scan to join
                  </ThemedText>
                </View>

                <ThemedText variant="bodySm" tone="muted" style={{ fontSize: 12, lineHeight: 17 }}>
                  Friends can scan this QR from Join with invite.
                </ThemedText>
              </View>

              <View
                style={{
                  padding: 10,
                  backgroundColor: "#FFFFFF",
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "#E2E8F0"
                }}
              >
                <QRCode
                  value={inviteUrl}
                  size={124}
                  backgroundColor="#FFFFFF"
                  color="#171922"
                />
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {contactError ? <InlineNotice title="Contacts unavailable" body={contactError} tone="owe" /> : null}
      {membershipActionError ? <InlineNotice title="Membership action failed" body={membershipActionError} tone="owe" /> : null}

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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  navIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  titleBlock: {
    flex: 1,
    gap: 4
  },
  editName: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2
  },
  headerRename: {
    gap: 12,
    padding: 14
  },
  summaryRow: {
    gap: 10,
    paddingRight: 8
  },
  summaryCard: {
    width: 148,
    padding: 12,
    gap: 6
  },
  summaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  summaryFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  summaryCaption: {
    flex: 1
  },
  expenseRow: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10
  },
  expenseRowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0
  },
  expenseCategoryAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  expenseCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0
  },
  expenseTrailing: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 6,
    maxWidth: 108,
    flexShrink: 0
  },
  expenseEditButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
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
  currencyBlock: {
    gap: 2
  },
  currencyValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  primaryRow: {
    flexDirection: "row",
    gap: 10,
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
  auditLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
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
  cardHeaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center"
  },
  addContactsPillButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14
  },
  formBlock: {
    gap: 12,
    padding: 14
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
  inviteActions: {
    flexDirection: "row",
    gap: 10
  },
  inviteBlock: {
    gap: 10,
    alignItems: "flex-start"
  },
  qrHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4
  },
  qrBox: {
    padding: 12,
    alignSelf: "flex-start"
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

async function shareBalanceSummary(group: GroupDetail, balances: Array<{ displayName: string; balanceMinor: number; currencyCode: string }>) {
  const lines = balances.length
    ? balances.map((row) => `${row.displayName}: ${formatSignedMoney(row.balanceMinor, row.currencyCode)}`)
    : ["All balances are settled."];
  await Share.share({
    message: [`SplitSaathi balance summary for ${group.name}`, ...lines].join("\n")
  });
}
