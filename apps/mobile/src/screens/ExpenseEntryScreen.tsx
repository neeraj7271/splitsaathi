import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Paperclip, Plus, Scales } from "phosphor-react-native";

import { ApiError, apiClient, CreateExpenseRequest } from "../api/client";
import { Button } from "../components/Button";
import { DataSurface } from "../components/DataSurface";
import { EmptyState } from "../components/EmptyState";
import { GroupSelector } from "../components/GroupSelector";
import { InlineNotice } from "../components/InlineNotice";
import { InputField } from "../components/InputField";
import { ParticipantPicker } from "../components/ParticipantPicker";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { SegmentedControl } from "../components/SegmentedControl";
import { ThemedText } from "../components/ThemedText";
import { useTheme } from "../theme";
import { SplitType } from "../types/domain";
import { AppNavigation } from "../types/navigation";
import { enqueueCommand } from "../offline/outbox";
import { formatMoney, parseAmountToMinor } from "../utils/money";

type AdjustmentType = "tax" | "gst_cgst" | "gst_sgst" | "service_charge" | "tip" | "discount" | "rounding";

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
  const queryClient = useQueryClient();
  const groupsQuery = useQuery({ queryKey: ["groups"], queryFn: () => apiClient.listGroups() });
  const groups = groupsQuery.data ?? [];
  const selectedGroupId = navigation.selectedGroupId ?? groups[0]?.id;
  const groupQuery = useQuery({
    queryKey: ["group", selectedGroupId],
    queryFn: () => apiClient.getGroup(selectedGroupId as string),
    enabled: Boolean(selectedGroupId)
  });

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
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
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>("gst_cgst");
  const [message, setMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const participants = groupQuery.data?.participants ?? [];

  useEffect(() => {
    if (!navigation.selectedGroupId && groups[0]?.id) {
      navigation.setSelectedGroupId(groups[0].id);
    }
  }, [groups, navigation]);

  useEffect(() => {
    if (participants.length && selectedShares.length === 0) {
      setSelectedShares(participants.map((participant) => participant.id));
    }
    if (participants.length && selectedPayers.length === 0) {
      setSelectedPayers([participants[0].id]);
    }
  }, [participants, selectedPayers.length, selectedShares.length]);

  const totalMinor = splitType === "itemized" ? itemizedTotalMinor(lineItems, adjustments) : parseAmountToMinor(amount);
  const payerTotalMinor = selectedPayers.reduce((total, payerId) => {
    if (selectedPayers.length === 1) {
      return total + totalMinor;
    }
    return total + parseAmountToMinor(payerAmounts[payerId] ?? "");
  }, 0);
  const computedShares = useMemo(
    () => computeShares(totalMinor, selectedShares, splitType, shareAmounts, shareWeights, lineItems, adjustments),
    [adjustments, lineItems, selectedShares, shareAmounts, shareWeights, splitType, totalMinor]
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

  const submit = async () => {
    if (!selectedGroupId) {
      return;
    }
    setSubmitting(true);
    setMessage(undefined);

    const payload = buildExpensePayload({
      groupId: selectedGroupId,
      description,
      category,
      totalMinor,
      selectedPayers,
      payerAmounts,
      selectedShares,
      splitType,
      computedShares,
      shareAmounts,
      shareWeights,
      lineItems,
      adjustments
    });

    try {
      await apiClient.createExpense(payload);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expenses", selectedGroupId] }),
        queryClient.invalidateQueries({ queryKey: ["balances", selectedGroupId] }),
        queryClient.invalidateQueries({ queryKey: ["groupActivity", selectedGroupId] })
      ]);
      setMessage("Expense posted to the ledger.");
      setDescription("");
      setAmount("");
      setLineItems([]);
      setAdjustments([]);
      navigation.go("groupDetail");
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(error.message);
      } else {
        await enqueueCommand("expense.create", payload as unknown as Record<string, unknown>);
        setMessage("Network unavailable. Expense create command was queued for sync.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <ThemedText variant="caption" tone="muted">
            Expense entry
          </ThemedText>
          <ThemedText variant="title">Multiple payers and shares</ThemedText>
        </View>
        <Button label="Queue" variant="secondary" onPress={() => navigation.go("offline")} />
      </View>

      {groups.length ? <GroupSelector groups={groups} selectedGroupId={selectedGroupId} onSelect={navigation.setSelectedGroupId} /> : null}
      {!selectedGroupId ? <EmptyState title="No group available" body="Create or import a group before posting expenses." action={{ label: "Groups", onPress: () => navigation.go("groups") }} /> : null}
      {groupQuery.error ? <InlineNotice title="Group could not load" body={groupQuery.error.message} tone="owe" /> : null}

      {selectedGroupId && participants.length ? (
        <>
          <DataSurface>
            <View style={styles.formBlock}>
              <InputField label="Description" value={description} onChangeText={setDescription} placeholder="Groceries, rent, dinner" />
              {splitType !== "itemized" ? <InputField label="Total amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" amount /> : null}
              <InputField label="Category optional" value={category} onChangeText={setCategory} />
              <Button label="Attach receipt or proof image" variant="secondary" onPress={attachReceipt} />
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

          <ParticipantPicker
            title="Payers"
            participants={participants}
            selectedIds={selectedPayers}
            onToggle={(participantId) =>
              setSelectedPayers((current) => (current.includes(participantId) ? current.filter((id) => id !== participantId) : [...current, participantId]))
            }
          />
          {selectedPayers.length > 1 ? (
            <DataSurface>
              {selectedPayers.map((payerId) => (
                <View key={payerId} style={[styles.amountRow, { borderBottomColor: theme.colors.hairline }]}>
                  <ThemedText variant="bodyMedium">{participants.find((participant) => participant.id === payerId)?.displayName ?? payerId}</ThemedText>
                  <InputField label="Paid amount" value={payerAmounts[payerId] ?? ""} onChangeText={(value) => setPayerAmounts((current) => ({ ...current, [payerId]: value }))} keyboardType="decimal-pad" amount style={styles.inlineInput} />
                </View>
              ))}
            </DataSurface>
          ) : null}

          <ParticipantPicker
            title="Beneficiaries"
            participants={participants}
            selectedIds={selectedShares}
            onToggle={(participantId) =>
              setSelectedShares((current) => (current.includes(participantId) ? current.filter((id) => id !== participantId) : [...current, participantId]))
            }
          />

          {splitType === "exact" ? (
            <DataSurface>
              {selectedShares.map((shareId) => (
                <View key={shareId} style={[styles.amountRow, { borderBottomColor: theme.colors.hairline }]}>
                  <ThemedText variant="bodyMedium">{participants.find((participant) => participant.id === shareId)?.displayName ?? shareId}</ThemedText>
                  <InputField label="Share amount" value={shareAmounts[shareId] ?? ""} onChangeText={(value) => setShareAmounts((current) => ({ ...current, [shareId]: value }))} keyboardType="decimal-pad" amount style={styles.inlineInput} />
                </View>
              ))}
            </DataSurface>
          ) : null}

          {splitType === "weight" ? (
            <DataSurface>
              {selectedShares.map((shareId) => (
                <View key={shareId} style={[styles.amountRow, { borderBottomColor: theme.colors.hairline }]}>
                  <ThemedText variant="bodyMedium">{participants.find((participant) => participant.id === shareId)?.displayName ?? shareId}</ThemedText>
                  <InputField label="Weight" value={shareWeights[shareId] ?? "1"} onChangeText={(value) => setShareWeights((current) => ({ ...current, [shareId]: value }))} keyboardType="number-pad" style={styles.inlineInput} />
                </View>
              ))}
            </DataSurface>
          ) : null}

          {splitType === "itemized" ? (
            <View style={styles.section}>
              <SectionHeader title="Manual itemization" />
              <DataSurface>
                <View style={styles.formBlock}>
                  <InputField label="Line item" value={lineLabel} onChangeText={setLineLabel} />
                  <InputField label="Line amount" value={lineAmount} onChangeText={setLineAmount} keyboardType="decimal-pad" amount />
                  <Button label="Add line item for selected beneficiaries" variant="secondary" onPress={addLineItem} disabled={!lineLabel.trim() || !lineAmount.trim()} />
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
            <SectionHeader title="Adjustments and rounding" />
            <DataSurface>
              <View style={styles.formBlock}>
                <SegmentedControl
                  value={adjustmentType}
                  options={[
                    { label: "GST", value: "gst_cgst" },
                    { label: "Service", value: "service_charge" },
                    { label: "Tip", value: "tip" },
                    { label: "Discount", value: "discount" }
                  ]}
                  onChange={setAdjustmentType}
                />
                <InputField label="Adjustment amount" value={adjustmentAmount} onChangeText={setAdjustmentAmount} keyboardType="decimal-pad" amount />
                <Button label="Add adjustment" variant="secondary" onPress={addAdjustment} disabled={!adjustmentAmount.trim()} />
              </View>
              {adjustments.map((adjustment, index) => (
                <View key={`${adjustment.adjustmentType}-${index}`} style={[styles.dataRow, { borderTopColor: theme.colors.hairline }]}>
                  <ThemedText variant="bodyMedium">{adjustment.label}</ThemedText>
                  <ThemedText variant="amount">{formatMoney(parseAmountToMinor(adjustment.amount))}</ThemedText>
                </View>
              ))}
            </DataSurface>

            <DataSurface>
              <View style={styles.reviewBlock}>
                <View style={styles.reviewRow}>
                  <ThemedText variant="bodyMedium">Total</ThemedText>
                  <ThemedText variant="amount">{formatMoney(totalMinor)}</ThemedText>
                </View>
                <View style={styles.reviewRow}>
                  <ThemedText variant="bodyMedium">Payer difference</ThemedText>
                  <ThemedText variant="amount" tone={payerDifference === 0 ? "confirmed" : "owe"}>
                    {formatMoney(Math.abs(payerDifference))}
                  </ThemedText>
                </View>
                <View style={styles.reviewRow}>
                  <ThemedText variant="bodyMedium">Share difference</ThemedText>
                  <ThemedText variant="amount" tone={shareDifference === 0 ? "confirmed" : "owe"}>
                    {formatMoney(Math.abs(shareDifference))}
                  </ThemedText>
                </View>
                <View style={[styles.statusBar, { backgroundColor: balanced ? theme.colors.confirmed : theme.colors.owe, borderRadius: theme.radius.full }]} />
                <ThemedText variant="bodySm" tone="muted">
                  Rounding residual: {computedShares.residualMinor} paise, allocated by largest remainder with deterministic participant ordering.
                </ThemedText>
              </View>
            </DataSurface>
          </View>

          {message ? <InlineNotice title="Expense status" body={message} tone={message.includes("queued") ? "pending" : message.includes("failed") ? "owe" : "confirmed"} /> : null}
          <Button label="Review and post expense" onPress={submit} loading={submitting} disabled={!balanced || !description.trim()} />
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
    expenseDate: new Date().toISOString().slice(0, 10),
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

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  formBlock: {
    gap: 12,
    padding: 14
  },
  section: {
    gap: 12
  },
  amountRow: {
    gap: 12,
    padding: 14,
    borderBottomWidth: 1
  },
  inlineInput: {
    minHeight: 48
  },
  dataRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderTopWidth: 1,
    gap: 12
  },
  reviewBlock: {
    gap: 10,
    padding: 14
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  statusBar: {
    height: 4
  }
});
