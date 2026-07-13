import React, { useMemo, useState } from "react";
import { Alert, Pressable, Share, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, LinkSimple, LockKey, UserPlus } from "phosphor-react-native";
import QRCode from "react-native-qrcode-svg";

import { apiClient } from "../api/client";
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
import { hasContactsConsent, syncDeviceContacts, type SyncedContact } from "../utils/contactDiscovery";

type GroupTab = "activity" | "balances" | "expenses" | "charts" | "people";

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

  const groupsQuery = useQuery({ queryKey: ["groups"], queryFn: () => apiClient.listGroups() });
  const selectedGroupId = navigation.selectedGroupId ?? groupsQuery.data?.[0]?.id;
  const groupQuery = useQuery({
    queryKey: ["group", selectedGroupId],
    queryFn: () => apiClient.getGroup(selectedGroupId as string),
    enabled: Boolean(selectedGroupId)
  });
  const activityQuery = useQuery({
    queryKey: ["groupActivity", selectedGroupId],
    queryFn: () => apiClient.getGroupActivity(selectedGroupId as string),
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
  const roleChange = useMutation({
    mutationFn: ({ membershipId, role }: { membershipId: string; role: MembershipRole }) => apiClient.updateMembershipRole(selectedGroupId as string, membershipId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["group", selectedGroupId] })
  });
  const lockExit = useMutation({
    mutationFn: (membershipId: string) => apiClient.lockMemberExit(selectedGroupId as string, membershipId),
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
  const enrichedBalances = useMemo(() => {
    if (!group || !balancesQuery.data) {
      return [];
    }
    return enrichBalanceRows(balancesQuery.data, buildGroupDisplayLookups(group));
  }, [balancesQuery.data, group]);
  const enrichedActivity = useMemo(() => {
    if (!group || !activityQuery.data?.length) {
      return activityQuery.data ?? [];
    }
    return enrichActivityRows(activityQuery.data, buildGroupDisplayLookups(group), group.name);
  }, [activityQuery.data, group]);

  return (
    <Screen>
      <View style={styles.header}>
        <UserAvatar displayName={group?.name ?? "Group"} avatarUrl={group?.imageUrl} size={48} />
        <View style={styles.titleBlock}>
          <ThemedText variant="caption" tone="muted">
            Group ledger
          </ThemedText>
          <ThemedText variant="title">{group?.name ?? "Select group"}</ThemedText>
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
                <ThemedText variant="amount" tone={(group.netBalanceMinor ?? 0) >= 0 ? "receive" : "owe"} align="right">
                  {formatSignedMoney(group.netBalanceMinor, group.baseCurrencyCode)}
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
              {enrichedActivity.length ? <DataSurface>{enrichedActivity.map((item) => <ActivityRow key={item.id} item={item} />)}</DataSurface> : <EmptyState title="No activity" body="Expense creates, edits, proofs, and settlements will appear here." />}
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
              roleChange={(membershipId, role) => roleChange.mutate({ membershipId, role })}
              lockExit={(membershipId) => lockExit.mutate(membershipId)}
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
  roleChange,
  lockExit,
  onAddFromContacts,
  contactError
}: {
  group: GroupDetail;
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
  roleChange: (membershipId: string, role: MembershipRole) => void;
  lockExit: (membershipId: string) => void;
  onAddFromContacts: () => void;
  contactError?: string | null;
}) {
  const theme = useTheme();
  const lookups = buildGroupDisplayLookups(group);

  return (
    <View style={styles.section}>
      <SectionHeader title="People and roles" />
      <DataSurface>
        {group.memberships.map((membership) => {
          const displayName = resolveParticipantDisplayName(membership.participantId, lookups) ?? "Unknown participant";
          return (
            <View key={membership.id} style={[styles.personRow, { borderBottomColor: theme.colors.hairline }]}>
              <View style={styles.titleBlock}>
                <ThemedText variant="bodyMedium">{displayName}</ThemedText>
                <ThemedText variant="bodySm" tone="muted">
                  {membership.role} - {membership.status}
                </ThemedText>
              </View>
              <View style={styles.roleButtons}>
                {(["admin", "member", "viewer"] as MembershipRole[]).map((role) => (
                  <Pressable key={role} onPress={() => roleChange(membership.id, role)} style={[styles.roleChip, { borderColor: theme.colors.hairline, borderRadius: theme.radius.sm }]}>
                    <ThemedText variant="caption" tone={membership.role === role ? "confirmed" : "muted"}>
                      {role}
                    </ThemedText>
                  </Pressable>
                ))}
                {membership.status === "active" ? (
                  <Pressable onPress={() => lockExit(membership.id)} style={[styles.iconButton, { borderColor: theme.colors.hairline }]}>
                    <LockKey size={16} color={theme.colors.inkMuted} weight="duotone" />
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
      </DataSurface>

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

      {contactError ? <InlineNotice title="Contacts unavailable" body={contactError} tone="owe" /> : null}

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

      <Button label="Archive group" variant="destructive" onPress={archiveGroup} loading={archivePending} />
      <InlineNotice title="Archive, do not erase" body="Financial history remains available for audit, balances, and exports." tone="pending" />
    </View>
  );
}

const styles = StyleSheet.create({
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
