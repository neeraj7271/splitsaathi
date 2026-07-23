import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarBlank, Paperclip } from "phosphor-react-native";

import { ApiError, apiClient, CreateExpenseRequest } from "../api/client";
import { useOptionalAppDialog } from "../components/AppDialog";
import { Button } from "../components/Button";
import { DataSurface } from "../components/DataSurface";
import { EmptyState } from "../components/EmptyState";
import { GroupSelector } from "../components/GroupSelector";
import { InlineNotice } from "../components/InlineNotice";
import { InputField } from "../components/InputField";
import { ParticipantPicker } from "../components/ParticipantPicker";
import { Screen } from "../components/Screen";
import { ScreenBackButton } from "../components/ScreenBackButton";
import { SectionHeader } from "../components/SectionHeader";
import { SegmentedControl } from "../components/SegmentedControl";
import { SettingsToggleRow } from "../components/SettingsToggleRow";
import { ThemedText } from "../components/ThemedText";
import { useTheme } from "../theme";
import { ExpenseDetail, SplitType } from "../types/domain";
import { AppNavigation } from "../types/navigation";
import { enqueueCommand } from "../offline/outbox";
import { formatMoney, parseAmountToMinor } from "../utils/money";
import { activeGroupParticipants } from "../utils/groupPeople";

type AdjustmentType = "tax" | "gst_cgst" | "gst_sgst" | "service_charge" | "tip" | "discount" | "rounding";
type PartyTab = "payers" | "beneficiaries";

interface DraftLineItem {
  label: string;
  amount: string;
  participantIds: string[];
}

interface DraftAdjustment {
  adjustmentType: AdjustmentType;
  label: string;
  amount: string;
}

export function ExpenseEntryScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const dialog = useOptionalAppDialog();
  const queryClient = useQueryClient();
  const editingExpenseId = navigation.selectedExpenseId;
  const isEditing = Boolean(editingExpenseId);
  const hydratedExpenseId = useRef<string | undefined>(undefined);
  const groupsQuery = useQuery({ queryKey: ["groups"], queryFn: () => apiClient.listGroups() });
  const groups = groupsQuery.data ?? [];
  const selectedGroupId = navigation.selectedGroupId ?? groups[0]?.id;
  const groupQuery = useQuery({
    queryKey: ["group", selectedGroupId],
    queryFn: () => apiClient.getGroup(selectedGroupId as string),
    enabled: Boolean(selectedGroupId)
  });
  const expenseQuery = useQuery({
    queryKey: ["expense", editingExpenseId],
    queryFn: () => apiClient.getExpense(editingExpenseId as string),
    enabled: Boolean(editingExpenseId)
  });

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [selectedPayers, setSelectedPayers] = useState<string[]>([]);
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});
  const [selectedShares, setSelectedShares] = useState<string[]>([]);
  const [shareAmounts, setShareAmounts] = useState<Record<string, string>>({});
  const [shareWeights, setShareWeights] = useState<Record<string, string>>({});
  const [lineItems, setLineItems] = useState<DraftLineItem[]>([]);
  const [lineLabel, setLineLabel] = useState("");
  const [lineAmount, setLineAmount] = useState("");
  const [adjustments, setAdjustments] = useState<DraftAdjustment[]>([]);
  const [showAdjustments, setShowAdjustments] = useState(false);
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>("gst_cgst");
  const [partyTab, setPartyTab] = useState<PartyTab>("payers");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [receiptName, setReceiptName] = useState<string>();

  const participants = groupQuery.data ? activeGroupParticipants(groupQuery.data) : [];
  const participantNameById = useMemo(() => new Map(participants.map((participant) => [participant.id, participant.displayName])), [participants]);
  const nameForParticipant = (participantId: string) => participantNameById.get(participantId) ?? "Unknown participant";
  const profileQuery = useQuery({ queryKey: ["me"], queryFn: () => apiClient.getMe() });
  const myRole = groupQuery.data?.memberships.find((membership) => membership.userId === profileQuery.data?.id)?.role;
  const canManageExpense =
    typeof groupQuery.data?.canManageExpenses === "boolean"
      ? groupQuery.data.canManageExpenses
      : myRole === "owner" || myRole === "admin" || myRole === "member";
  const editingExpense = expenseQuery.data;
  const isVoided = editingExpense?.state === "voided";

  useEffect(() => {
    if (!navigation.selectedGroupId && groups[0]?.id) {
      navigation.setSelectedGroupId(groups[0].id);
    }
  }, [groups, navigation]);

  useEffect(() => {
    if (!editingExpenseId) {
      hydratedExpenseId.current = undefined;
      return;
    }
    if (!expenseQuery.data || hydratedExpenseId.current === expenseQuery.data.id) {
      return;
    }
    applyExpenseToForm(expenseQuery.data, {
      setDescription,
      setCategory,
      setNotes,
      setAmount,
      setExpenseDate,
      setSplitType,
      setSelectedPayers,
      setPayerAmounts,
      setSelectedShares,
      setShareAmounts,
      setShareWeights,
      setLineItems,
      setAdjustments,
      setShowAdjustments
    });
    if (expenseQuery.data.groupId) {
      navigation.setSelectedGroupId(expenseQuery.data.groupId);
    }
    hydratedExpenseId.current = expenseQuery.data.id;
  }, [editingExpenseId, expenseQuery.data, navigation]);

  useEffect(() => {
    if (isEditing) {
      return;
    }
    if (participants.length && selectedShares.length === 0) {
      setSelectedShares(participants.map((participant) => participant.id));
    }
    if (participants.length && selectedPayers.length === 0) {
      setSelectedPayers([participants[0].id]);
    }
  }, [participants, selectedPayers.length, selectedShares.length, isEditing]);

  const activeAdjustments = showAdjustments ? adjustments : [];
  const totalMinor = splitType === "itemized" ? itemizedTotalMinor(lineItems, activeAdjustments) : parseAmountToMinor(amount);
  const payerTotalMinor = selectedPayers.reduce((total, payerId) => {
    if (selectedPayers.length === 1) {
      return total + totalMinor;
    }
    return total + parseAmountToMinor(payerAmounts[payerId] ?? "");
  }, 0);
  const computedShares = useMemo(
    () => computeShares(totalMinor, selectedShares, splitType, shareAmounts, shareWeights, lineItems, activeAdjustments),
    [activeAdjustments, lineItems, selectedShares, shareAmounts, shareWeights, splitType, totalMinor]
  );
  const shareTotalMinor = Object.values(computedShares.allocations).reduce((total, value) => total + value, 0);
  const payerDifference = payerTotalMinor - totalMinor;
  const shareDifference = shareTotalMinor - totalMinor;
  const balanced = totalMinor > 0 && payerDifference === 0 && shareDifference === 0 && selectedPayers.length > 0 && selectedShares.length > 0;

  const addLineItem = () => {
    if (!lineLabel.trim() || !lineAmount.trim()) {
      return;
    }
    setLineItems((current) => [
      ...current,
      {
        label: lineLabel.trim(),
        amount: lineAmount,
        participantIds: selectedShares.length ? selectedShares : participants.map((participant) => participant.id)
      }
    ]);
    setLineLabel("");
    setLineAmount("");
  };

  const addAdjustment = () => {
    if (!adjustmentAmount.trim()) {
      return;
    }
    setAdjustments((current) => [
      ...current,
      {
        adjustmentType,
        label: adjustmentType.replace(/_/g, " "),
        amount: adjustmentAmount
      }
    ]);
    setAdjustmentAmount("");
  };

  const attachReceipt = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ["image/*", "application/pdf"], copyToCacheDirectory: true });
    if (result.canceled || !selectedGroupId) {
      return;
    }

    const asset = result.assets[0];
    const attachment = await apiClient.uploadAttachment(
      {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? "application/octet-stream"
      },
      "receipt"
    );
    setReceiptName(asset.name);
    const draft = await apiClient.createReceiptDraft(selectedGroupId, attachment.id);
    const ocr = await apiClient.analyzeReceiptDraft(draft.id);
    if (ocr.items.length) {
      setSplitType("itemized");
      setLineItems(
        ocr.items.map((item) => ({
          label: item.label,
          amount: String(item.amountMinor / 100),
          participantIds: selectedShares.length ? selectedShares : participants.map((participant) => participant.id)
        }))
      );
      setMessage(`Receipt OCR found ${ocr.items.length} review items. Check assignments before posting.`);
    } else {
      setMessage("Receipt attached as a draft. No OCR items were found; add itemization manually.");
    }
  };

  const invalidateExpenseQueries = async (groupId: string, expenseId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["expenses", groupId] }),
      queryClient.invalidateQueries({ queryKey: ["balances", groupId] }),
      queryClient.invalidateQueries({ queryKey: ["groupActivity", groupId] }),
      queryClient.invalidateQueries({ queryKey: ["group", groupId] }),
      queryClient.invalidateQueries({ queryKey: ["groups"] }),
      expenseId ? queryClient.invalidateQueries({ queryKey: ["expense", expenseId] }) : Promise.resolve(),
      expenseId ? queryClient.invalidateQueries({ queryKey: ["expenseHistory", expenseId] }) : Promise.resolve(),
      expenseId ? queryClient.invalidateQueries({ queryKey: ["expenseExplanation", expenseId] }) : Promise.resolve()
    ]);
  };

  const voidExpense = useMutation({
    mutationFn: async () => {
      if (!editingExpenseId || !selectedGroupId || !editingExpense) {
        throw new Error("Expense is not available.");
      }
      if (!reason.trim()) {
        throw new Error("A reason is required to delete an expense.");
      }
      await apiClient.voidExpense(editingExpenseId, reason.trim(), selectedGroupId, editingExpense.currentVersion);
    },
    onSuccess: async () => {
      if (selectedGroupId) {
        await invalidateExpenseQueries(selectedGroupId, editingExpenseId);
      }
      navigation.setSelectedExpenseId(undefined);
      if (!navigation.back()) {
        navigation.go("groupDetail");
      }
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : "Could not delete expense.");
    }
  });

  const submit = async () => {
    if (!selectedGroupId) {
      return;
    }
    if (isEditing && !canManageExpense) {
      setMessage("Only group owners and admins can edit expenses.");
      return;
    }
    if (isEditing && !reason.trim()) {
      setMessage("Add a short reason so the change is audited.");
      return;
    }
    if (isVoided) {
      setMessage("This expense is already deleted.");
      return;
    }
    setSubmitting(true);
    setMessage(undefined);

    const payload = buildExpensePayload({
      groupId: selectedGroupId,
      description,
      category,
      notes,
      expenseDate,
      totalMinor,
      selectedPayers,
      payerAmounts,
      selectedShares,
      splitType,
      computedShares,
      shareAmounts,
      shareWeights,
      lineItems,
      adjustments: activeAdjustments
    });

    try {
      if (isEditing && editingExpenseId && editingExpense) {
        await apiClient.reviseExpense(editingExpenseId, {
          ...payload,
          baseVersion: editingExpense.currentVersion,
          reason: reason.trim()
        });
        await invalidateExpenseQueries(selectedGroupId, editingExpenseId);
        setMessage("Expense updated. Members were notified and the change is in audit history.");
        navigation.setSelectedExpenseId(undefined);
        if (!navigation.back()) {
          navigation.go("groupDetail");
        }
      } else {
        await apiClient.createExpense(payload);
        await invalidateExpenseQueries(selectedGroupId);
        setMessage("Expense posted to the ledger.");
        setDescription("");
        setAmount("");
        setNotes("");
        setLineItems([]);
        setAdjustments([]);
        navigation.setSelectedExpenseId(undefined);
        if (!navigation.back()) {
          navigation.go("groupDetail");
        }
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(error.message);
      } else if (!isEditing) {
        await enqueueCommand("expense.create", payload as unknown as Record<string, unknown>);
        setMessage("Network unavailable. Expense create command was queued for sync.");
      } else {
        setMessage(error instanceof Error ? error.message : "Could not update expense.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = () => {
    if (!reason.trim()) {
      setMessage("Add a delete reason before removing this expense.");
      return;
    }
    dialog?.showDialog({
      title: "Delete this expense?",
      message: "Balances will reverse. The delete reason is kept in audit history and other members are notified.",
      tone: "warning",
      secondaryAction: { label: "Cancel", variant: "secondary" },
      primaryAction: {
        label: "Delete expense",
        variant: "destructive",
        onPress: () => voidExpense.mutate()
      }
    });
  };

  return (
    <Screen>
      <ScreenBackButton navigation={navigation} label="Back" />
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <ThemedText variant="caption" tone="muted">
            {isEditing ? "Expense edit" : "Expense entry"}
          </ThemedText>
          <ThemedText variant="title" numberOfLines={1}>
            {isEditing ? "Edit expense" : "Add expense"}
          </ThemedText>
        </View>
        {isEditing ? (
          <Button
            label="History"
            variant="secondary"
            size="compact"
            onPress={() => navigation.go("audit")}
            style={styles.headerButton}
          />
        ) : (
          <Button label="Queue" variant="secondary" onPress={() => navigation.go("offline")} style={styles.headerButton} />
        )}
      </View>

      {groups.length && !isEditing ? (
        <GroupSelector groups={groups} selectedGroupId={selectedGroupId} onSelect={navigation.setSelectedGroupId} />
      ) : null}
      {!selectedGroupId ? <EmptyState title="No group available" body="Create or import a group before posting expenses." action={{ label: "Groups", onPress: () => navigation.go("groups") }} /> : null}
      {groupQuery.error ? <InlineNotice title="Group could not load" body={groupQuery.error.message} tone="owe" /> : null}
      {isEditing && expenseQuery.isLoading ? <InlineNotice title="Loading expense" body="Fetching the current snapshot for editing." tone="pending" /> : null}
      {isEditing && expenseQuery.error ? (
        <InlineNotice title="Expense could not load" body={expenseQuery.error.message} tone="owe" />
      ) : null}
      {isVoided ? (
        <InlineNotice
          title="Expense deleted"
          body={editingExpense?.voidReason ? `Reason: ${editingExpense.voidReason}` : "This expense was voided and can no longer be edited."}
          tone="owe"
        />
      ) : null}
      {isEditing && !canManageExpense ? (
        <InlineNotice title="View only" body="Only group owners and admins can edit or delete expenses." tone="info" />
      ) : null}

      {selectedGroupId && participants.length ? (
        <>
          <DataSurface>
            <View style={styles.formBlock}>
              <InputField label="Description" value={description} onChangeText={setDescription} placeholder="Groceries, rent, dinner" />
              {splitType !== "itemized" ? (
                <InputField label="Total amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" amount />
              ) : null}
              <InputField label="Category optional" value={category} onChangeText={setCategory} />
              <InputField
                label="Notes optional"
                value={notes}
                onChangeText={setNotes}
                placeholder="Extra context for this expense"
                multiline
                style={{ minHeight: 72, textAlignVertical: "top", paddingTop: 14 }}
              />
              <View style={styles.iconActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Expense date ${expenseDate.toLocaleDateString("en-IN")}`}
                  onPress={() => setDatePickerVisible(true)}
                  style={[styles.iconAction, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.surfaceRaised }]}
                >
                  <CalendarBlank size={20} color={theme.colors.ink} weight="duotone" />
                  <ThemedText variant="bodySm">{expenseDate.toLocaleDateString("en-IN")}</ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Attach receipt or proof image"
                  onPress={() => void attachReceipt()}
                  style={[styles.iconAction, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.surfaceRaised }]}
                >
                  <Paperclip size={20} color={theme.colors.ink} weight="duotone" />
                  <ThemedText variant="bodySm" numberOfLines={1}>
                    {receiptName ? receiptName : "Receipt"}
                  </ThemedText>
                </Pressable>
              </View>
              {datePickerVisible ? (
                <DateTimePicker
                  value={expenseDate}
                  mode="date"
                  maximumDate={new Date()}
                  onChange={(_, date) => {
                    setDatePickerVisible(false);
                    if (date) {
                      setExpenseDate(date);
                    }
                  }}
                />
              ) : null}
            </View>
          </DataSurface>

          <SegmentedControl
            value={splitType}
            options={[
              { label: "Equal", value: "equal" },
              { label: "Exact", value: "exact" },
              { label: "Shares", value: "weight" },
              { label: "Itemized", value: "itemized" }
            ]}
            onChange={setSplitType}
          />

          <SegmentedControl
            value={partyTab}
            options={[
              { label: "Payers", value: "payers" },
              { label: "Beneficiaries", value: "beneficiaries" }
            ]}
            onChange={setPartyTab}
          />

          {partyTab === "payers" ? (
            <>
              <ParticipantPicker
                title="Who paid?"
                participants={participants}
                selectedIds={selectedPayers}
                onToggle={(participantId) =>
                  setSelectedPayers((current) =>
                    current.includes(participantId) ? current.filter((id) => id !== participantId) : [...current, participantId]
                  )
                }
              />
              {selectedPayers.length > 1 ? (
                <DataSurface>
                  {selectedPayers.map((payerId) => (
                    <View key={payerId} style={[styles.amountRow, { borderBottomColor: theme.colors.hairline }]}>
                      <ThemedText variant="bodyMedium">{nameForParticipant(payerId)}</ThemedText>
                      <InputField
                        label="Paid amount"
                        value={payerAmounts[payerId] ?? ""}
                        onChangeText={(value) => setPayerAmounts((current) => ({ ...current, [payerId]: value }))}
                        keyboardType="decimal-pad"
                        amount
                        style={styles.inlineInput}
                      />
                    </View>
                  ))}
                </DataSurface>
              ) : null}
            </>
          ) : (
            <>
              <ParticipantPicker
                title="Split between"
                participants={participants}
                selectedIds={selectedShares}
                onToggle={(participantId) =>
                  setSelectedShares((current) =>
                    current.includes(participantId) ? current.filter((id) => id !== participantId) : [...current, participantId]
                  )
                }
              />

              {splitType === "exact" ? (
                <DataSurface>
                  {selectedShares.map((shareId) => (
                    <View key={shareId} style={[styles.amountRow, { borderBottomColor: theme.colors.hairline }]}>
                      <ThemedText variant="bodyMedium">{nameForParticipant(shareId)}</ThemedText>
                      <InputField
                        label="Share amount"
                        value={shareAmounts[shareId] ?? ""}
                        onChangeText={(value) => setShareAmounts((current) => ({ ...current, [shareId]: value }))}
                        keyboardType="decimal-pad"
                        amount
                        style={styles.inlineInput}
                      />
                    </View>
                  ))}
                </DataSurface>
              ) : null}

              {splitType === "weight" ? (
                <DataSurface>
                  {selectedShares.map((shareId) => (
                    <View key={shareId} style={[styles.amountRow, { borderBottomColor: theme.colors.hairline }]}>
                      <ThemedText variant="bodyMedium">{nameForParticipant(shareId)}</ThemedText>
                      <InputField
                        label="Weight"
                        value={shareWeights[shareId] ?? "1"}
                        onChangeText={(value) => setShareWeights((current) => ({ ...current, [shareId]: value }))}
                        keyboardType="number-pad"
                        style={styles.inlineInput}
                      />
                    </View>
                  ))}
                </DataSurface>
              ) : null}
            </>
          )}

          {splitType === "itemized" ? (
            <View style={styles.section}>
              <SectionHeader title="Manual itemization" />
              <DataSurface>
                <View style={styles.formBlock}>
                  <InputField label="Line item" value={lineLabel} onChangeText={setLineLabel} />
                  <InputField label="Line amount" value={lineAmount} onChangeText={setLineAmount} keyboardType="decimal-pad" amount />
                  <Button
                    label="Add line item for selected beneficiaries"
                    variant="secondary"
                    onPress={addLineItem}
                    disabled={!lineLabel.trim() || !lineAmount.trim()}
                  />
                </View>
                {lineItems.map((lineItem, index) => (
                  <View key={`${lineItem.label}-${index}`} style={[styles.dataRow, { borderTopColor: theme.colors.hairline }]}>
                    <View>
                      <ThemedText variant="bodyMedium">{lineItem.label}</ThemedText>
                      <ThemedText variant="bodySm" tone="muted">
                        {lineItem.participantIds.length} assigned
                      </ThemedText>
                    </View>
                    <ThemedText variant="amount">{formatMoney(parseAmountToMinor(lineItem.amount))}</ThemedText>
                  </View>
                ))}
              </DataSurface>
            </View>
          ) : null}

          <View style={styles.section}>
            <SettingsToggleRow label="Adjustments and rounding" value={showAdjustments} onValueChange={setShowAdjustments} />
            {showAdjustments ? (
              <DataSurface>
                <View style={styles.formBlock}>
                  <ThemedText variant="caption" tone="muted">
                    Tax, tip, discount, or explicit rounding paisa. Equal/share splits also auto-distribute leftover paisa by largest remainder.
                  </ThemedText>
                  <SegmentedControl
                    value={adjustmentType}
                    options={[
                      { label: "GST", value: "gst_cgst" },
                      { label: "Service", value: "service_charge" },
                      { label: "Tip", value: "tip" },
                      { label: "Discount", value: "discount" },
                      { label: "Round", value: "rounding" }
                    ]}
                    onChange={setAdjustmentType}
                  />
                  <InputField
                    label={adjustmentType === "rounding" ? "Rounding amount (±)" : "Adjustment amount"}
                    value={adjustmentAmount}
                    onChangeText={setAdjustmentAmount}
                    keyboardType="decimal-pad"
                    amount
                  />
                  <Button label="Add adjustment" variant="secondary" onPress={addAdjustment} disabled={!adjustmentAmount.trim()} />
                </View>
                {adjustments.map((adjustment, index) => (
                  <View key={`${adjustment.adjustmentType}-${index}`} style={[styles.dataRow, { borderTopColor: theme.colors.hairline }]}>
                    <ThemedText variant="bodyMedium">{adjustment.label}</ThemedText>
                    <ThemedText variant="amount">{formatMoney(parseAmountToMinor(adjustment.amount))}</ThemedText>
                  </View>
                ))}
                {computedShares.residualMinor > 0 ? (
                  <View style={[styles.dataRow, { borderTopColor: theme.colors.hairline }]}>
                    <ThemedText variant="bodySm" tone="muted">
                      Auto rounding effect
                    </ThemedText>
                    <ThemedText variant="bodySm" tone="muted">
                      {computedShares.residualMinor}p by largest remainder
                    </ThemedText>
                  </View>
                ) : null}
              </DataSurface>
            ) : null}

            <DataSurface>
              <View style={styles.reviewBlock}>
                <View style={styles.reviewRow}>
                  <ThemedText variant="section">Total</ThemedText>
                  <ThemedText variant="amount">{formatMoney(totalMinor)}</ThemedText>
                </View>

                <ThemedText variant="caption" tone="muted" style={styles.reviewSubhead}>
                  Paid by
                </ThemedText>
                {selectedPayers.map((payerId) => {
                  const paid = selectedPayers.length === 1 ? totalMinor : parseAmountToMinor(payerAmounts[payerId] ?? "");
                  return (
                    <View key={payerId} style={styles.reviewRow}>
                      <ThemedText variant="bodyMedium">{nameForParticipant(payerId)}</ThemedText>
                      <ThemedText variant="amount" tone={paid > 0 ? "ink" : "muted"}>
                        {formatMoney(paid)}
                      </ThemedText>
                    </View>
                  );
                })}
                {payerDifference !== 0 ? (
                  <View style={styles.reviewRow}>
                    <ThemedText variant="bodySm" tone="owe">
                      Payer gap
                    </ThemedText>
                    <ThemedText variant="amountSm" tone="owe">
                      {payerDifference > 0 ? "+" : "-"}
                      {formatMoney(Math.abs(payerDifference))}
                    </ThemedText>
                  </View>
                ) : null}

                <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

                <ThemedText variant="caption" tone="muted" style={styles.reviewSubhead}>
                  Split between
                </ThemedText>
                {selectedShares.map((shareId) => {
                  const share = computedShares.allocations[shareId] ?? 0;
                  return (
                    <View key={shareId} style={styles.reviewRow}>
                      <ThemedText variant="bodyMedium">{nameForParticipant(shareId)}</ThemedText>
                      <ThemedText variant="amount" tone={share > 0 ? "ink" : "muted"}>
                        {formatMoney(share)}
                      </ThemedText>
                    </View>
                  );
                })}
                {shareDifference !== 0 ? (
                  <View style={styles.reviewRow}>
                    <ThemedText variant="bodySm" tone="owe">
                      Share gap
                    </ThemedText>
                    <ThemedText variant="amountSm" tone="owe">
                      {shareDifference > 0 ? "+" : "-"}
                      {formatMoney(Math.abs(shareDifference))}
                    </ThemedText>
                  </View>
                ) : null}

                <View style={[styles.statusBar, { backgroundColor: balanced ? theme.colors.confirmed : theme.colors.owe, borderRadius: theme.radius.full }]} />
                {computedShares.residualMinor > 0 ? (
                  <ThemedText variant="bodySm" tone="muted">
                    {computedShares.residualMinor}p rounding distributed by largest-remainder.
                  </ThemedText>
                ) : null}
              </View>
            </DataSurface>
          </View>

          {message ? (
            <InlineNotice
              title="Expense status"
              body={message}
              tone={message.includes("queued") ? "pending" : message.includes("failed") || message.includes("required") || message.includes("Could not") ? "owe" : "confirmed"}
            />
          ) : null}
          {!description.trim() ? (
            <InlineNotice title="Description required" body="Enter a description for this expense before posting." tone="info" />
          ) : null}
          {description.trim() && !balanced ? (
            <InlineNotice
              title="Amounts don't balance"
              body={`Total: ${formatMoney(totalMinor)}. Enter a non-zero total and ensure payer and share amounts match it exactly.`}
              tone="owe"
            />
          ) : null}
          {isEditing ? (
            <InputField
              label="Reason for change"
              value={reason}
              onChangeText={setReason}
              placeholder="Corrected amount, wrong split, etc."
            />
          ) : null}
          <Button
            label={isEditing ? "Save expense changes" : "Review and post expense"}
            onPress={submit}
            loading={submitting}
            disabled={!balanced || !description.trim() || isVoided || (isEditing && (!canManageExpense || !reason.trim()))}
          />
          {isEditing && canManageExpense && !isVoided ? (
            <Button
              label="Delete expense"
              variant="destructive"
              onPress={confirmDelete}
              loading={voidExpense.isPending}
              disabled={!reason.trim()}
            />
          ) : null}
        </>
      ) : selectedGroupId ? (
        <EmptyState title="No participants" body="Add people to this group before creating expenses." action={{ label: "Manage group", onPress: () => navigation.go("groupDetail") }} />
      ) : null}
    </Screen>
  );
}

function itemizedTotalMinor(lineItems: DraftLineItem[], adjustments: DraftAdjustment[]) {
  const lineTotal = lineItems.reduce((total, line) => total + parseAmountToMinor(line.amount), 0);
  const adjustmentTotal = adjustments.reduce((total, adjustment) => {
    const amount = parseAmountToMinor(adjustment.amount);
    return total + (adjustment.adjustmentType === "discount" ? -amount : amount);
  }, 0);

  return Math.max(0, lineTotal + adjustmentTotal);
}

function allocateByWeight(totalMinor: number, ids: string[], weights: Record<string, number>) {
  const sign = totalMinor < 0 ? -1 : 1;
  const absoluteTotalMinor = Math.abs(totalMinor);
  const totalWeight = ids.reduce((total, id) => total + Math.max(0, weights[id] ?? 1), 0);
  if (!totalWeight) {
    return { allocations: {}, residualMinor: totalMinor };
  }

  const rows = ids.map((id) => {
    const raw = (absoluteTotalMinor * Math.max(0, weights[id] ?? 1)) / totalWeight;
    const floor = Math.floor(raw);
    return { id, floor, remainder: raw - floor };
  });
  let residual = absoluteTotalMinor - rows.reduce((total, row) => total + row.floor, 0);
  rows
    .sort((a, b) => b.remainder - a.remainder || a.id.localeCompare(b.id))
    .forEach((row) => {
      if (residual > 0) {
        row.floor += 1;
        residual -= 1;
      }
    });

  return {
    allocations: Object.fromEntries(rows.map((row) => [row.id, row.floor * sign])),
    residualMinor: absoluteTotalMinor - ids.reduce((total, id) => total + Math.floor((absoluteTotalMinor * Math.max(0, weights[id] ?? 1)) / totalWeight), 0)
  };
}

function computeShares(
  totalMinor: number,
  selectedShares: string[],
  splitType: SplitType,
  shareAmounts: Record<string, string>,
  shareWeights: Record<string, string>,
  lineItems: DraftLineItem[],
  adjustments: DraftAdjustment[]
) {
  if (!selectedShares.length) {
    return { allocations: {} as Record<string, number>, residualMinor: totalMinor };
  }

  if (splitType === "exact") {
    return {
      allocations: Object.fromEntries(selectedShares.map((id) => [id, parseAmountToMinor(shareAmounts[id] ?? "")])),
      residualMinor: 0
    };
  }

  if (splitType === "weight") {
    return allocateByWeight(
      totalMinor,
      selectedShares,
      Object.fromEntries(selectedShares.map((id) => [id, Number.parseInt(shareWeights[id] || "1", 10) || 1]))
    );
  }

  if (splitType === "itemized") {
    const allocations: Record<string, number> = Object.fromEntries(selectedShares.map((id) => [id, 0]));
    lineItems.forEach((line) => {
      const result = allocateByWeight(parseAmountToMinor(line.amount), line.participantIds, Object.fromEntries(line.participantIds.map((id) => [id, 1])));
      Object.entries(result.allocations).forEach(([id, value]) => {
        allocations[id] = (allocations[id] ?? 0) + value;
      });
    });
    const adjustmentMinor = adjustments.reduce((total, adjustment) => total + (adjustment.adjustmentType === "discount" ? -parseAmountToMinor(adjustment.amount) : parseAmountToMinor(adjustment.amount)), 0);
    const adjustmentAllocation = allocateByWeight(adjustmentMinor, selectedShares, Object.fromEntries(selectedShares.map((id) => [id, 1])));
    Object.entries(adjustmentAllocation.allocations).forEach(([id, value]) => {
      allocations[id] = (allocations[id] ?? 0) + value;
    });

    return { allocations, residualMinor: adjustmentAllocation.residualMinor };
  }

  return allocateByWeight(totalMinor, selectedShares, Object.fromEntries(selectedShares.map((id) => [id, 1])));
}

function buildExpensePayload(input: {
  groupId: string;
  description: string;
  category?: string;
  notes?: string;
  expenseDate: Date;
  totalMinor: number;
  selectedPayers: string[];
  payerAmounts: Record<string, string>;
  selectedShares: string[];
  splitType: SplitType;
  computedShares: { allocations: Record<string, number>; residualMinor: number };
  shareAmounts: Record<string, string>;
  shareWeights: Record<string, string>;
  lineItems: DraftLineItem[];
  adjustments: DraftAdjustment[];
}): CreateExpenseRequest {
  return {
    groupId: input.groupId,
    description: input.description.trim(),
    category: input.category?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    expenseDate: formatExpenseDate(input.expenseDate),
    currencyCode: "INR",
    payers: input.selectedPayers.map((participantId) => ({
      participantId,
      amountMinor: input.selectedPayers.length === 1 ? input.totalMinor : parseAmountToMinor(input.payerAmounts[participantId] ?? "")
    })),
    shares: input.selectedShares.map((participantId) => ({
      participantId,
      shareType: input.splitType === "weight" ? "weight" : input.splitType,
      amountMinor: input.splitType === "exact" || input.splitType === "itemized" ? input.computedShares.allocations[participantId] ?? 0 : undefined,
      weightNumerator: input.splitType === "weight" ? Number.parseInt(input.shareWeights[participantId] || "1", 10) || 1 : undefined,
      weightDenominator: input.splitType === "weight" ? 1 : undefined
    })),
    lineItems:
      input.splitType === "itemized"
        ? input.lineItems.map((lineItem) => ({
            label: lineItem.label,
            amountMinor: parseAmountToMinor(lineItem.amount),
            participantIds: lineItem.participantIds
          }))
        : undefined,
    billAdjustments: input.adjustments.map((adjustment) => ({
      adjustmentType: adjustment.adjustmentType,
      label: adjustment.label,
      amountMinor: parseAmountToMinor(adjustment.amount),
      allocationBasis: "subtotal_proportional"
    }))
  };
}

function formatExpenseDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function minorToAmountInput(amountMinor: number) {
  return (amountMinor / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function inferSplitType(expense: ExpenseDetail): SplitType {
  if (expense.lineItems.length) {
    return "itemized";
  }
  const types = [...new Set(expense.shares.map((share) => share.shareType))];
  if (types.length === 1) {
    if (types[0] === "equal" || types[0] === "exact" || types[0] === "itemized") {
      return types[0];
    }
    // Weight numerators are not retained after allocation — keep amounts via exact.
    if (types[0] === "weight") {
      return "exact";
    }
  }
  return "exact";
}

function applyExpenseToForm(
  expense: ExpenseDetail,
  setters: {
    setDescription: (value: string) => void;
    setCategory: (value: string) => void;
    setNotes: (value: string) => void;
    setAmount: (value: string) => void;
    setExpenseDate: (value: Date) => void;
    setSplitType: (value: SplitType) => void;
    setSelectedPayers: (value: string[]) => void;
    setPayerAmounts: (value: Record<string, string>) => void;
    setSelectedShares: (value: string[]) => void;
    setShareAmounts: (value: Record<string, string>) => void;
    setShareWeights: (value: Record<string, string>) => void;
    setLineItems: (value: DraftLineItem[]) => void;
    setAdjustments: (value: DraftAdjustment[]) => void;
    setShowAdjustments: (value: boolean) => void;
  }
) {
  const split = inferSplitType(expense);
  setters.setDescription(expense.description);
  setters.setCategory(expense.category ?? "");
  setters.setNotes(expense.notes ?? "");
  setters.setAmount(minorToAmountInput(expense.totalAmountMinor));
  const parsedDate = new Date(`${expense.expenseDate}T12:00:00`);
  setters.setExpenseDate(Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate);
  setters.setSplitType(split);
  setters.setSelectedPayers(expense.payers.map((payer) => payer.participantId));
  setters.setPayerAmounts(
    Object.fromEntries(expense.payers.map((payer) => [payer.participantId, minorToAmountInput(payer.amountMinor)]))
  );
  setters.setSelectedShares(expense.shares.map((share) => share.participantId));
  setters.setShareAmounts(
    Object.fromEntries(expense.shares.map((share) => [share.participantId, minorToAmountInput(share.amountMinor)]))
  );
  setters.setShareWeights(Object.fromEntries(expense.shares.map((share) => [share.participantId, "1"])));
  setters.setLineItems(
    expense.lineItems.map((item) => ({
      label: item.label,
      amount: minorToAmountInput(item.amountMinor),
      participantIds: item.participantIds
    }))
  );
  const nextAdjustments = expense.billAdjustments.map((adjustment) => ({
    adjustmentType: (adjustment.adjustmentType as AdjustmentType) || "tax",
    label: adjustment.label,
    amount: minorToAmountInput(adjustment.amountMinor)
  }));
  setters.setAdjustments(nextAdjustments);
  setters.setShowAdjustments(nextAdjustments.length > 0);
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  headerTitle: {
    flex: 1,
    gap: 2
  },
  headerButton: {
    flexShrink: 0
  },
  formBlock: {
    gap: 10,
    padding: 12
  },
  iconActions: {
    flexDirection: "row",
    gap: 8
  },
  iconAction: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12
  },
  section: {
    gap: 10
  },
  amountRow: {
    gap: 10,
    padding: 12,
    borderBottomWidth: 1
  },
  inlineInput: {
    minHeight: 44
  },
  dataRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderTopWidth: 1,
    gap: 12
  },
  reviewBlock: {
    gap: 8,
    padding: 12
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  reviewSubhead: {
    marginTop: 4
  },
  divider: {
    height: 1,
    marginVertical: 6
  },
  statusBar: {
    height: 4,
    marginTop: 4
  }
});
