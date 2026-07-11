import React, { useState } from "react";
import { Pressable, Share, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, LinkSimple, LockKey, UserPlus } from "phosphor-react-native";
import QRCode from "react-native-qrcode-svg";

import { apiClient } from "../api/client";
import { ActivityRow } from "../components/ActivityRow";
import { Button } from "../components/Button";
import { DataSurface } from "../components/DataSurface";
import { EmptyState } from "../components/EmptyState";
import { GroupSelector } from "../components/GroupSelector";
import { InlineNotice } from "../components/InlineNotice";
import { InputField } from "../components/InputField";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { SegmentedControl } from "../components/SegmentedControl";
import { StatusPill } from "../components/StatusPill";
import { ThemedText } from "../components/ThemedText";
import { useTheme } from "../theme";
import { GroupDetail, MembershipRole } from "../types/domain";
import { AppNavigation } from "../types/navigation";
import { formatMoney, formatSignedMoney } from "../utils/money";

type GroupTab = "activity" | "balances" | "expenses" | "people";

export function GroupDetailScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<GroupTab>("activity");
  const [newParticipantName, setNewParticipantName] = useState("");
  const [newParticipantPhone, setNewParticipantPhone] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string>();

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

  const addParticipant = useMutation({
    mutationFn: () => apiClient.addParticipant(selectedGroupId as string, newParticipantName, newParticipantPhone || undefined),
    onSuccess: () => {
      setNewParticipantName("");
      setNewParticipantPhone("");
      queryClient.invalidateQueries({ queryKey: ["group", selectedGroupId] });
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

  const group = groupQuery.data;

  return (
    <Screen>
      <View style={styles.header}>
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
              { label: "People", value: "people" }
            ]}
            onChange={setTab}
          />

          {tab === "activity" ? (
            <View style={styles.section}>
              <SectionHeader title="Activity" action={<Button label="Audit" variant="ghost" onPress={() => navigation.go("audit")} />} />
              {activityQuery.error ? <InlineNotice title="Activity could not load" body={activityQuery.error.message} tone="owe" /> : null}
              {activityQuery.data?.length ? <DataSurface>{activityQuery.data.map((item) => <ActivityRow key={item.id} item={item} />)}</DataSurface> : <EmptyState title="No activity" body="Expense creates, edits, proofs, and settlements will appear here." />}
            </View>
          ) : null}

          {tab === "balances" ? (
            <View style={styles.section}>
              <SectionHeader
                title="Balances"
                action={<Button label="Share" variant="ghost" onPress={() => shareBalanceSummary(group, balancesQuery.data ?? [])} />}
              />
              {balancesQuery.error ? <InlineNotice title="Balances could not load" body={balancesQuery.error.message} tone="owe" /> : null}
              {balancesQuery.data?.length ? (
                <DataSurface>
                  {balancesQuery.data.map((row) => (
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
                        navigation.setSelectedExpenseId(expense.id);
                        navigation.go("audit");
                      }}
                      style={[styles.dataRow, { borderBottomColor: theme.colors.hairline }]}
                    >
                      <View style={styles.titleBlock}>
                        <ThemedText variant="bodyMedium">{expense.description}</ThemedText>
                        <ThemedText variant="bodySm" tone="muted">
                          {expense.category || "Expense"} - v{expense.currentVersion}
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
            />
          ) : null}
        </>
      ) : null}
    </Screen>
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
  lockExit
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
}) {
  const theme = useTheme();
  const participantById = new Map(group.participants.map((participant) => [participant.id, participant]));

  return (
    <View style={styles.section}>
      <SectionHeader title="People and roles" />
      <DataSurface>
        {group.memberships.map((membership) => {
          const participant = participantById.get(membership.participantId);
          return (
            <View key={membership.id} style={[styles.personRow, { borderBottomColor: theme.colors.hairline }]}>
              <View style={styles.titleBlock}>
                <ThemedText variant="bodyMedium">{participant?.displayName ?? membership.participantId}</ThemedText>
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
        </View>
      </DataSurface>

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
