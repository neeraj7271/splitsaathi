import React, { useMemo, useState } from "react";
import { Alert, Pressable, Share, StyleSheet, View } from "react-native";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CaretLeft, ImageSquare, LinkSimple, LockKey, LockKeyOpen, Trash, UserMinus, UserPlus } from "phosphor-react-native";
import * as ImagePicker from "expo-image-picker";
import QRCode from "react-native-qrcode-svg";

import { ApiError, apiClient } from "../api/client";
import { ActionSheet } from "../components/ActionSheet";
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
import { StatusPill } from "../components/StatusPill";
import { ThemedText } from "../components/ThemedText";
import { UserAvatar } from "../components/UserAvatar";
import { useTheme } from "../theme";
import { ExpenseExplanation, GroupDetail, MembershipRole } from "../types/domain";
import { AppNavigation } from "../types/navigation";
import { formatMoney, formatSignedMoney } from "../utils/money";
import { buildGroupDisplayLookups, enrichActivityRows, enrichBalanceRows, participantList, resolveParticipantDisplayName } from "../utils/displayNames";
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
    }
  });
  const unarchiveGroup = useMutation({
    mutationFn: () => apiClient.unarchiveGroup(selectedGroupId as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["group", selectedGroupId] });
    }
  });
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
    return enrichBalanceRows(balancesQuery.data, buildGroupDisplayLookups(group));
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
    Alert.alert("Leave group?", "You can leave only when your balance is settled.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () => leaveGroup.mutate()
      }
    ]);
  }

  function confirmRemoveMember(membershipId: string, displayName: string) {
    setMembershipActionError(null);
    Alert.alert(`Remove ${displayName}?`, "They can only be removed when their balance is settled.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => removeMember.mutate(membershipId)
      }
    ]);
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
          {canEditGroup ? (
            <ThemedText variant="caption" tone="muted">
              Tap logo to change
            </ThemedText>
          ) : null}
        </View>
        {group?.state === "archived" ? <StatusPill state="expired" /> : null}
      </View>

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
              <Button label="Add expense" variant="secondary" onPress={() => navigation.go("expense")} style={styles.inlineButton} />
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
              <SectionHeader title="Expenses" action={<Button label="Add" variant="ghost" onPress={() => navigation.go("expense")} />} />
              {expensesQuery.error ? <InlineNotice title="Expenses could not load" body={expensesQuery.error.message} tone="owe" /> : null}
              {expensesQuery.data?.length ? (
                <DataSurface>
                  {expensesQuery.data.map((expense) => (
                    <Pressable
                      key={expense.id}
                      onPress={() => {
                        setExplainingExpenseId(expense.id);
                      }}
                      onLongPress={() => {
                        navigation.setSelectedExpenseId(expense.id);
                        navigation.go("audit");
                      }}
                      style={[styles.dataRow, { borderBottomColor: theme.colors.hairline }]}
                    >
                      <View style={styles.titleBlock}>
                        <ThemedText variant="bodyMedium">{expense.description}</ThemedText>
                        <ThemedText variant="bodySm" tone="muted">
                          {expense.category || "Expense"} - v{expense.currentVersion} · Tap for split details
                        </ThemedText>
                      </View>
                      <View style={styles.trailing}>
                        <ThemedText variant="amount">{formatMoney(expense.totalAmountMinor, expense.currencyCode)}</ThemedText>
                        {expense.state === "voided" ? <StatusPill state="rejected" /> : null}
                      </View>
                    </Pressable>
                  ))}
                </DataSurface>
              ) : (
                <EmptyState title="No expenses yet" body="Add equal, exact, shares, or itemized expenses with multiple payers." action={{ label: "Add expense", onPress: () => navigation.go("expense") }} />
              )}
              {explainingExpenseId ? (
                <ExpenseExplanationSection
                  explanation={explanationQuery.data}
                  lookups={buildGroupDisplayLookups(group)}
                  loading={explanationQuery.isLoading}
                  error={explanationQuery.error instanceof Error ? explanationQuery.error.message : undefined}
                  onClose={() => setExplainingExpenseId(undefined)}
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
              archiveGroup={() => archiveGroup.mutate()}
              archivePending={archiveGroup.isPending}
              unarchiveGroup={() => unarchiveGroup.mutate()}
              unarchivePending={unarchiveGroup.isPending}
              leaveGroup={confirmLeaveGroup}
              leavePending={leaveGroup.isPending}
              removeMember={confirmRemoveMember}
              removePending={removeMember.isPending}
              membershipActionError={membershipActionError}
              updateGroupImagePending={updateGroupImage.isPending}
              updateGroupImageError={updateGroupImage.error instanceof Error ? updateGroupImage.error.message : null}
              onOpenLogoSheet={() => setLogoSheetVisible(true)}
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
  lookups,
  loading,
  error,
  onClose
}: {
  explanation?: ExpenseExplanation;
  lookups: ReturnType<typeof buildGroupDisplayLookups>;
  loading: boolean;
  error?: string;
  onClose: () => void;
}) {
  const theme = useTheme();
  const nameFor = (participantId: string) => resolveParticipantDisplayName(participantId, lookups) ?? "Unknown participant";
  return (
    <View style={styles.section}>
      <SectionHeader title="How this expense is split" action={<Button label="Close" variant="ghost" onPress={onClose} />} />
      {loading ? <InlineNotice title="Calculating split" body="Reading the immutable expense snapshot." tone="pending" /> : null}
      {error ? <InlineNotice title="Explanation unavailable" body={error} tone="owe" /> : null}
      {explanation ? (
        <DataSurface>
          <View style={styles.explanationBlock}>
            <ThemedText variant="bodyMedium">{explanation.explanation}</ThemedText>
            <ThemedText variant="bodySm" tone="muted">Snapshot version {explanation.snapshotVersion} · {explanation.splitMethod} split</ThemedText>
            <ThemedText variant="caption" tone="muted">Paid</ThemedText>
            {explanation.paidBy.map((payer) => <ThemedText key={payer.participantId} variant="bodySm">{nameFor(payer.participantId)}: {payer.formattedAmount}</ThemedText>)}
            <ThemedText variant="caption" tone="muted">Owed</ThemedText>
            {explanation.owedBy.map((share) => <ThemedText key={share.participantId} variant="bodySm">{nameFor(share.participantId)}: {share.formattedAmount} ({share.shareType})</ThemedText>)}
            {explanation.itemizedDetail?.lineItems.map((item) => (
              <View key={`${item.label}-${item.amountMinor}`} style={[styles.explanationItem, { borderTopColor: theme.colors.hairline }]}>
                <ThemedText variant="bodySm">{item.label}: {item.formattedAmount}</ThemedText>
                <ThemedText variant="caption" tone="muted">Shared by {participantList(item.participantIds, lookups)}</ThemedText>
              </View>
            ))}
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
  updateGroupImagePending,
  updateGroupImageError,
  onOpenLogoSheet,
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
  updateGroupImagePending: boolean;
  updateGroupImageError: string | null;
  onOpenLogoSheet: () => void;
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
            <View style={styles.logoRow}>
              <UserAvatar
                displayName={group.name}
                avatarUrl={group.imageUrl}
                size={72}
                editable
                loading={updateGroupImagePending}
                onPress={onOpenLogoSheet}
              />
              <View style={styles.logoActions}>
                <ThemedText variant="bodyMedium">Group logo</ThemedText>
                <ThemedText variant="bodySm" tone="muted">
                  {group.imageUrl ? "Tap to change or remove" : "Tap the camera to add a logo"}
                </ThemedText>
              </View>
            </View>
            {updateGroupImageError ? <InlineNotice title="Logo update failed" body={updateGroupImageError} tone="owe" /> : null}
          </View>
        </DataSurface>
      ) : null}

      <DataSurface>
        {group.memberships.map((membership) => {
          const displayName = resolveParticipantDisplayName(membership.participantId, lookups) ?? "Unknown participant";
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
            <Button label="Unarchive group" onPress={unarchiveGroup} loading={unarchivePending} />
            <InlineNotice title="Group is archived" body="Unarchive to allow new expenses and settlements again." tone="pending" />
          </>
        ) : (
          <>
            <Button label="Archive group" variant="destructive" onPress={archiveGroup} loading={archivePending} />
            <InlineNotice title="Archive, do not erase" body="Financial history remains available for audit, balances, and exports." tone="pending" />
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
