import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calculator,
  CalendarBlank,
  Car,
  CaretDown,
  Clock,
  CurrencyInr,
  DotsThree,
  FilmSlate,
  ForkKnife,
  HandCoins,
  ListBullets,
  Lightning,
  NotePencil,
  Paperclip,
  Percent,
  Plus,
  Receipt,
  Scales,
  ShoppingBag,
  Storefront,
  Tag,
  X
} from "phosphor-react-native";

import { ApiError, apiClient, CreateExpenseRequest, formatApiErrorMessage } from "../api/client";
import { useOptionalAppDialog } from "../components/AppDialog";
import { Button } from "../components/Button";
import { CalculatorModal } from "../components/CalculatorModal";
import { DataSurface } from "../components/DataSurface";
import { EmptyState } from "../components/EmptyState";
import { GroupSelector } from "../components/GroupSelector";
import { groupTypeAccent } from "../components/GroupTypeAvatar";
import { InlineNotice } from "../components/InlineNotice";
import { InputField } from "../components/InputField";
import { ParticipantPicker } from "../components/ParticipantPicker";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { SearchableSelect } from "../components/SearchableSelect";
import { SectionHeader } from "../components/SectionHeader";
import { SegmentedControl } from "../components/SegmentedControl";
import { SettingsToggleRow } from "../components/SettingsToggleRow";
import { ThemedText } from "../components/ThemedText";
import { colorWithAlpha, useTheme } from "../theme";
import { ExpenseDetail, SplitType } from "../types/domain";
import { AppNavigation } from "../types/navigation";
import { enqueueCommand, getOutboxStatus } from "../offline/outbox";
import { amountToRupeeWords, formatMoney, formatSignedMoney, parseAmountToMinor } from "../utils/money";
import { activeGroupParticipants, reconcileParticipantSelection } from "../utils/groupPeople";
import { buildGroupDisplayLookups, resolveParticipantDisplayName } from "../utils/displayNames";
import { activeGroupsByOutstandingBalance } from "../utils/groupSort";

type AdjustmentType = "tax" | "gst_cgst" | "gst_sgst" | "service_charge" | "tip" | "discount" | "rounding";
type PartyTab = "payers" | "beneficiaries";

const NOTES_MAX = 120;

const EXPENSE_CATEGORIES: Array<{
  id: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string; weight?: "duotone" | "bold" | "fill" | "regular" }>;
  tint: string;
}> = [
  { id: "Groceries", label: "Groceries", Icon: ShoppingBag, tint: "#0D9488" },
  { id: "Food", label: "Food", Icon: ForkKnife, tint: "#F97316" },
  { id: "Transport", label: "Transport", Icon: Car, tint: "#3B82F6" },
  { id: "Utilities", label: "Utilities", Icon: Lightning, tint: "#EAB308" },
  { id: "Entertainment", label: "Entertainment", Icon: FilmSlate, tint: "#EC4899" },
  { id: "__more__", label: "More", Icon: DotsThree, tint: "#94A3B8" }
];

const ADJUSTMENT_TYPE_OPTIONS: Array<{
  label: string;
  value: AdjustmentType;
  Icon: React.ComponentType<{ size?: number; color?: string; weight?: "duotone" | "bold" | "fill" | "regular" }>;
  iconColor: string;
}> = [
  { label: "GST (CGST)", value: "gst_cgst", Icon: Receipt, iconColor: "#0D9488" },
  { label: "GST (SGST)", value: "gst_sgst", Icon: Percent, iconColor: "#6366F1" },
  { label: "Tax", value: "tax", Icon: Scales, iconColor: "#3B82F6" },
  { label: "Service charge", value: "service_charge", Icon: Storefront, iconColor: "#F97316" },
  { label: "Tip", value: "tip", Icon: HandCoins, iconColor: "#EAB308" },
  { label: "Discount", value: "discount", Icon: Tag, iconColor: "#22C55E" },
  { label: "Rounding", value: "rounding", Icon: Calculator, iconColor: "#8B5CF6" }
];

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
  const expenseGroups = useMemo(() => activeGroupsByOutstandingBalance(groups), [groups]);
  const selectedGroupId = navigation.selectedGroupId ?? expenseGroups[0]?.id;
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
  const [calculatorVisible, setCalculatorVisible] = useState(false);
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
  const [adjustmentPickerOpen, setAdjustmentPickerOpen] = useState(false);
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>("gst_cgst");
  const [partyTab, setPartyTab] = useState<PartyTab>("payers");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [queuedOffline, setQueuedOffline] = useState(false);
  const [receiptName, setReceiptName] = useState<string>();
  const [queueCount, setQueueCount] = useState(0);
  const [categoryMore, setCategoryMore] = useState(false);
  const submitLockRef = useRef(false);

  function markFormDirty() {
    if (queuedOffline) {
      setQueuedOffline(false);
      setMessage(undefined);
    }
  }

  const participants = useMemo(
    () => (groupQuery.data ? activeGroupParticipants(groupQuery.data) : []),
    [groupQuery.data]
  );
  const groupLookups = useMemo(
    () => (groupQuery.data ? buildGroupDisplayLookups(groupQuery.data) : null),
    [groupQuery.data]
  );
  const nameForParticipant = (participantId: string) =>
    (groupLookups ? resolveParticipantDisplayName(participantId, groupLookups) : undefined) ?? "Unknown participant";
  const profileQuery = useQuery({ queryKey: ["me"], queryFn: () => apiClient.getMe() });
  const myParticipantId = useMemo(
    () => groupQuery.data?.memberships.find((membership) => membership.userId === profileQuery.data?.id)?.participantId,
    [groupQuery.data?.memberships, profileQuery.data?.id]
  );
  const myRole = groupQuery.data?.memberships.find((membership) => membership.userId === profileQuery.data?.id)?.role;
  const canManageExpense =
    typeof groupQuery.data?.canManageExpenses === "boolean"
      ? groupQuery.data.canManageExpenses
      : myRole === "owner" || myRole === "admin" || myRole === "member";
  const editingExpense = expenseQuery.data;
  const isVoided = editingExpense?.state === "voided";

  useEffect(() => {
    if (!navigation.selectedGroupId && expenseGroups[0]?.id) {
      navigation.setSelectedGroupId(expenseGroups[0].id);
    }
  }, [expenseGroups, navigation]);

  useEffect(() => {
    let active = true;
    void getOutboxStatus()
      .then((status) => {
        if (active) {
          setQueueCount(status.queued + status.failed + status.syncing);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [queuedOffline, submitting]);

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
    setSelectedShares((current) => {
      const next = reconcileParticipantSelection(current, participants, "all");
      return next.join() === current.join() ? current : next;
    });
    setSelectedPayers((current) => {
      const next = reconcileParticipantSelection(current, participants, "self", myParticipantId);
      return next.join() === current.join() ? current : next;
    });
  }, [participants, isEditing, selectedGroupId, myParticipantId]);

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
  const summaryBalances = useMemo(
    () =>
      [...new Set([...selectedPayers, ...selectedShares])]
        .map((participantId) => {
          const paidMinor = payerPaidMinor(participantId, selectedPayers, totalMinor, payerAmounts);
          const owedMinor = computedShares.allocations[participantId] ?? 0;
          return { participantId, paidMinor, owedMinor, netMinor: paidMinor - owedMinor };
        })
        .sort((left, right) => right.netMinor - left.netMinor),
    [computedShares.allocations, payerAmounts, selectedPayers, selectedShares, totalMinor]
  );

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

  const removeLineItem = (index: number) => {
    markFormDirty();
    setLineItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const addAdjustment = () => {
    if (!adjustmentAmount.trim()) {
      return;
    }
    const selectedOption = ADJUSTMENT_TYPE_OPTIONS.find((option) => option.value === adjustmentType);
    setAdjustments((current) => [
      ...current,
      {
        adjustmentType,
        label: selectedOption?.label ?? adjustmentType.replace(/_/g, " "),
        amount: adjustmentAmount
      }
    ]);
    setAdjustmentAmount("");
  };

  const removeAdjustment = (index: number) => {
    markFormDirty();
    setAdjustments((current) => current.filter((_, itemIndex) => itemIndex !== index));
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
      queryClient.invalidateQueries({ queryKey: ["friends"] }),
      queryClient.invalidateQueries({ queryKey: ["myMonthlySpend"] }),
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
    if (!selectedGroupId || submitLockRef.current || submitting || queuedOffline) {
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
    submitLockRef.current = true;
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
        resetExpenseForm();
        navigation.setSelectedExpenseId(undefined);
        if (!navigation.back()) {
          navigation.go("groupDetail");
        }
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(formatApiErrorMessage(error.message));
      } else if (!isEditing) {
        await enqueueCommand("expense.create", payload as unknown as Record<string, unknown>);
        resetExpenseForm();
        setQueuedOffline(true);
        setMessage("Saved offline. This expense is in the sync queue and will post when you're back online.");
      } else {
        setMessage(error instanceof Error ? error.message : "Could not update expense.");
      }
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  };

  function resetExpenseForm() {
    setDescription("");
    setCategory("");
    setNotes("");
    setAmount("");
    setLineItems([]);
    setAdjustments([]);
    setShowAdjustments(false);
    setReason("");
    setReceiptName(undefined);
    setPayerAmounts({});
    setShareAmounts({});
    setShareWeights({});
    setSelectedPayers([]);
    setSelectedShares([]);
  }

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

  const selectedGroupSummary = expenseGroups.find((group) => group.id === selectedGroupId);
  const selectedGroupName = groupQuery.data?.name ?? selectedGroupSummary?.name;
  const selectedGroupAccent = groupTypeAccent(groupQuery.data?.groupType ?? selectedGroupSummary?.groupType);

  return (
    <>
    <Screen>
      <ScreenHeader
        navigation={navigation}
        fallbackRoute="home"
        titleContent={
          <View style={styles.headerTitle}>
            <ThemedText variant="title" numberOfLines={1}>
              {isEditing ? "Edit expense" : "Add expense"}
            </ThemedText>
            {selectedGroupId && selectedGroupName ? (
              <View
                style={[
                  styles.groupTag,
                  {
                    borderColor: colorWithAlpha(selectedGroupAccent, 0.35),
                    backgroundColor: colorWithAlpha(selectedGroupAccent, 0.12),
                    borderRadius: theme.radius.full
                  }
                ]}
              >
                <Tag size={12} color={selectedGroupAccent} weight="duotone" />
                <ThemedText variant="caption" numberOfLines={1} style={{ color: selectedGroupAccent, flexShrink: 1 }}>
                  {selectedGroupName}
                </ThemedText>
              </View>
            ) : null}
          </View>
        }
        trailing={
          isEditing ? (
            <Button label="History" variant="secondary" size="compact" onPress={() => navigation.go("audit")} style={styles.headerButton} />
          ) : (
            <Pressable
              onPress={() => navigation.go("offline")}
              style={[
                styles.queueChip,
                {
                  borderColor: colorWithAlpha(theme.colors.confirmed, 0.4),
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radius.full
                }
              ]}
            >
              <Clock size={14} color={theme.colors.confirmed} weight="duotone" />
              <ThemedText variant="caption" tone="confirmed">
                Queue{queueCount ? ` (${queueCount})` : ""}
              </ThemedText>
            </Pressable>
          )
        }
      />

      {expenseGroups.length && !isEditing ? (
        <GroupSelector groups={expenseGroups} selectedGroupId={selectedGroupId} onSelect={navigation.setSelectedGroupId} />
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
          {splitType !== "itemized" ? (
            <DataSurface elevated>
              <View style={styles.amountHero}>
                <View style={styles.amountHeroCopy}>
                  <ThemedText variant="caption" tone="muted">
                    Total amount
                  </ThemedText>
                  <View style={styles.amountInputRow}>
                    <ThemedText variant="balanceHero" style={styles.currencyPrefix}>
                      ₹
                    </ThemedText>
                    <TextInput
                      value={amount}
                      onChangeText={(value) => {
                        markFormDirty();
                        setAmount(value);
                      }}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={theme.colors.inkFaint}
                      style={[theme.typography.balanceHero, styles.amountInput, { color: theme.colors.ink }]}
                    />
                  </View>
                  <ThemedText variant="bodySm" tone="muted">
                    {amountToRupeeWords(totalMinor)}
                  </ThemedText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open calculator"
                  onPress={() => setCalculatorVisible(true)}
                  style={[
                    styles.calcChip,
                    {
                      borderColor: theme.colors.hairline,
                      backgroundColor: colorWithAlpha(theme.colors.confirmed, theme.mode === "dark" ? 0.16 : 0.1),
                      borderRadius: theme.radius.full
                    }
                  ]}
                >
                  <Calculator size={16} color={theme.colors.confirmed} weight="duotone" />
                  <ThemedText variant="caption" tone="confirmed">
                    Calculator
                  </ThemedText>
                </Pressable>
              </View>
            </DataSurface>
          ) : null}

          <DataSurface elevated>
            <View style={styles.descriptionRow}>
              <ListBullets size={18} color={theme.colors.inkMuted} weight="duotone" />
              <TextInput
                value={description}
                onChangeText={(value) => {
                  markFormDirty();
                  setDescription(value);
                }}
                placeholder="What was this for?"
                placeholderTextColor={theme.colors.inkFaint}
                style={[theme.typography.body, styles.descriptionInput, { color: theme.colors.ink }]}
              />
              {description ? (
                <Pressable
                  onPress={() => {
                    markFormDirty();
                    setDescription("");
                  }}
                  hitSlop={8}
                  accessibilityLabel="Clear description"
                >
                  <X size={16} color={theme.colors.inkMuted} weight="bold" />
                </Pressable>
              ) : null}
            </View>
          </DataSurface>

          <View style={styles.section}>
            <ThemedText variant="bodyMedium">Category (optional)</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              {EXPENSE_CATEGORIES.map((option) => {
                const active = option.id === "__more__" ? categoryMore : !categoryMore && category === option.id;
                const Icon = option.Icon;
                const chrome = theme.colors.confirmed;
                const labelColor = active ? chrome : theme.colors.inkMuted;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => {
                      markFormDirty();
                      if (option.id === "__more__") {
                        setCategoryMore(true);
                        if (EXPENSE_CATEGORIES.some((item) => item.id === category)) {
                          setCategory("");
                        }
                        return;
                      }
                      setCategoryMore(false);
                      setCategory(option.id);
                    }}
                    style={[
                      styles.categoryChip,
                      {
                        borderRadius: theme.radius.md,
                        borderColor: active ? chrome : theme.colors.hairline,
                        backgroundColor: active
                          ? colorWithAlpha(chrome, theme.mode === "dark" ? 0.18 : 0.1)
                          : theme.colors.surface
                      }
                    ]}
                  >
                    <Icon size={22} color={option.tint} weight="duotone" />
                    <ThemedText variant="caption" style={{ color: labelColor }}>
                      {option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
            {categoryMore ? (
              <InputField
                label="Custom category"
                value={category}
                onChangeText={(value) => {
                  markFormDirty();
                  setCategory(value);
                }}
                placeholder="e.g. Medical, Gifts"
              />
            ) : null}
          </View>

          <View style={styles.metaRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Expense date ${expenseDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
              onPress={() => setDatePickerVisible(true)}
              style={[styles.metaChip, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md }]}
            >
              <CalendarBlank size={18} color={theme.colors.inkMuted} weight="duotone" />
              <ThemedText variant="bodySm">
                {expenseDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </ThemedText>
              <CaretDown size={14} color={theme.colors.inkMuted} weight="bold" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Attach receipt or proof image"
              onPress={() => void attachReceipt()}
              style={[styles.metaChip, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md }]}
            >
              <Paperclip size={18} color={theme.colors.confirmed} weight="duotone" />
              <ThemedText variant="bodySm" tone="confirmed" numberOfLines={1} style={{ flex: 1 }}>
                {receiptName ? receiptName : "Add receipt"}
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

          <DataSurface elevated>
            <View style={styles.notesBlock}>
              <View style={styles.notesHeader}>
                <NotePencil size={16} color={theme.colors.inkMuted} weight="duotone" />
                <ThemedText variant="caption" tone="muted" style={{ flex: 1 }}>
                  Add a note (optional)
                </ThemedText>
                <ThemedText variant="caption" tone="faint">
                  {notes.length}/{NOTES_MAX}
                </ThemedText>
              </View>
              <TextInput
                value={notes}
                onChangeText={(value) => {
                  markFormDirty();
                  setNotes(value.slice(0, NOTES_MAX));
                }}
                placeholder="Extra context for this expense"
                placeholderTextColor={theme.colors.inkFaint}
                multiline
                style={[theme.typography.body, styles.notesInput, { color: theme.colors.ink }]}
              />
            </View>
          </DataSurface>

          <ThemedText variant="bodyMedium">Split type</ThemedText>
          <SegmentedControl
            value={splitType}
            scrollable={false}
            compact
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
                  {selectedPayers.map((payerId, index) => (
                    <View
                      key={payerId}
                      style={[
                        styles.itemizeRow,
                        index > 0 ? { borderTopColor: theme.colors.hairline } : { borderTopWidth: 0 }
                      ]}
                    >
                      <ThemedText variant="bodyMedium" numberOfLines={1} style={styles.itemizeRowCopy}>
                        {nameForParticipant(payerId)}
                      </ThemedText>
                      <View
                        style={[
                          styles.itemizeAmountField,
                          {
                            backgroundColor: theme.colors.surface,
                            borderColor: theme.colors.hairline,
                            borderRadius: theme.radius.md
                          }
                        ]}
                      >
                        <CurrencyInr size={14} color={theme.colors.inkMuted} weight="bold" />
                        <TextInput
                          value={payerAmounts[payerId] ?? ""}
                          onChangeText={(value) => setPayerAmounts((current) => ({ ...current, [payerId]: value }))}
                          placeholder="0"
                          placeholderTextColor={theme.colors.inkFaint}
                          keyboardType="decimal-pad"
                          style={[theme.typography.body, styles.itemizeAmountInput, { color: theme.colors.ink }]}
                        />
                      </View>
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
              <SectionHeader
                title="Manual itemization"
                action={
                  <ThemedText variant="caption" tone="muted" numberOfLines={1}>
                    Split with selected beneficiaries
                  </ThemedText>
                }
              />
              <DataSurface>
                <View style={[styles.itemizeComposer, { borderBottomColor: theme.colors.hairline }]}>
                  <View
                    style={[
                      styles.itemizeField,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.hairline,
                        borderRadius: theme.radius.md
                      }
                    ]}
                  >
                    <TextInput
                      value={lineLabel}
                      onChangeText={setLineLabel}
                      placeholder="Item name"
                      placeholderTextColor={theme.colors.inkFaint}
                      style={[theme.typography.body, styles.itemizeInput, { color: theme.colors.ink }]}
                    />
                  </View>
                  <View
                    style={[
                      styles.itemizeAmountField,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.hairline,
                        borderRadius: theme.radius.md
                      }
                    ]}
                  >
                    <CurrencyInr size={14} color={theme.colors.inkMuted} weight="bold" />
                    <TextInput
                      value={lineAmount}
                      onChangeText={setLineAmount}
                      placeholder="0"
                      placeholderTextColor={theme.colors.inkFaint}
                      keyboardType="decimal-pad"
                      style={[theme.typography.body, styles.itemizeAmountInput, { color: theme.colors.ink }]}
                    />
                  </View>
                  <Pressable
                    onPress={addLineItem}
                    disabled={!lineLabel.trim() || !lineAmount.trim()}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Add line item"
                    style={[
                      styles.iconActionButton,
                      {
                        borderColor: theme.colors.hairline,
                        opacity: !lineLabel.trim() || !lineAmount.trim() ? 0.4 : 1
                      }
                    ]}
                  >
                    <Plus size={16} color={theme.colors.confirmed} weight="bold" />
                  </Pressable>
                </View>
                {lineItems.map((lineItem, index) => (
                  <View key={`${lineItem.label}-${index}`} style={[styles.itemizeRow, { borderTopColor: theme.colors.hairline }]}>
                    <View style={styles.itemizeRowCopy}>
                      <ThemedText variant="bodyMedium" numberOfLines={1}>
                        {lineItem.label}
                      </ThemedText>
                      <ThemedText variant="caption" tone="muted" numberOfLines={1}>
                        {lineItem.participantIds.length} people
                      </ThemedText>
                    </View>
                    <ThemedText variant="amountSm">{formatMoney(parseAmountToMinor(lineItem.amount))}</ThemedText>
                    <Pressable
                      onPress={() => removeLineItem(index)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${lineItem.label}`}
                      style={[styles.removeButton, { borderColor: theme.colors.hairline }]}
                    >
                      <X size={16} color={theme.colors.owe} weight="bold" />
                    </Pressable>
                  </View>
                ))}
              </DataSurface>
            </View>
          ) : null}

          <View style={styles.section}>
            <SettingsToggleRow label="Adjustments and rounding" value={showAdjustments} onValueChange={setShowAdjustments} />
            {showAdjustments ? (
              <DataSurface elevated={adjustmentPickerOpen} style={adjustmentPickerOpen ? styles.expandedPickerSurface : undefined}>
                <View style={[styles.itemizeComposer, { borderBottomColor: theme.colors.hairline }]}>
                  <SearchableSelect
                    compact
                    value={adjustmentType}
                    options={ADJUSTMENT_TYPE_OPTIONS}
                    onChange={setAdjustmentType}
                    placeholder="Adjustment type"
                    onOpenChange={setAdjustmentPickerOpen}
                  />
                  <View
                    style={[
                      styles.itemizeAmountField,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.hairline,
                        borderRadius: theme.radius.md
                      }
                    ]}
                  >
                    <CurrencyInr size={14} color={theme.colors.inkMuted} weight="bold" />
                    <TextInput
                      value={adjustmentAmount}
                      onChangeText={setAdjustmentAmount}
                      placeholder={adjustmentType === "rounding" ? "±0" : "0"}
                      placeholderTextColor={theme.colors.inkFaint}
                      keyboardType="decimal-pad"
                      style={[theme.typography.body, styles.itemizeAmountInput, { color: theme.colors.ink }]}
                    />
                  </View>
                  <Pressable
                    onPress={addAdjustment}
                    disabled={!adjustmentAmount.trim()}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Add adjustment"
                    style={[
                      styles.iconActionButton,
                      {
                        borderColor: theme.colors.hairline,
                        opacity: !adjustmentAmount.trim() ? 0.4 : 1
                      }
                    ]}
                  >
                    <Plus size={16} color={theme.colors.confirmed} weight="bold" />
                  </Pressable>
                </View>
                {adjustments.map((adjustment, index) => (
                  <View key={`${adjustment.adjustmentType}-${index}`} style={[styles.itemizeRow, { borderTopColor: theme.colors.hairline }]}>
                    <ThemedText variant="bodyMedium" numberOfLines={1} style={styles.itemizeRowCopy}>
                      {adjustment.label}
                    </ThemedText>
                    <ThemedText variant="amountSm">
                      {adjustment.adjustmentType === "discount" ? "-" : ""}
                      {formatMoney(parseAmountToMinor(adjustment.amount))}
                    </ThemedText>
                    <Pressable
                      onPress={() => removeAdjustment(index)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${adjustment.label}`}
                      style={[styles.removeButton, { borderColor: theme.colors.hairline }]}
                    >
                      <X size={16} color={theme.colors.owe} weight="bold" />
                    </Pressable>
                  </View>
                ))}
                {computedShares.residualMinor > 0 ? (
                  <View style={[styles.dataRow, { borderTopColor: theme.colors.hairline }]}>
                    <ThemedText variant="bodySm" tone="muted">
                      Auto rounding effect
                    </ThemedText>
                    <ThemedText variant="bodySm" tone="muted">
                      {formatMoney(computedShares.residualMinor)} auto-rounded
                    </ThemedText>
                  </View>
                ) : null}
              </DataSurface>
            ) : null}

            <DataSurface elevated>
              <View style={styles.reviewBlock}>
                <View style={styles.reviewRow}>
                  <ThemedText variant="section">Summary</ThemedText>
                  <ThemedText variant="amountSm" tone="confirmed">
                    Total {formatMoney(totalMinor)}
                  </ThemedText>
                </View>

                <ThemedText variant="caption" tone="muted" style={styles.reviewSubhead}>
                  Paid by
                </ThemedText>
                {selectedPayers.map((payerId) => {
                  const paid = payerPaidMinor(payerId, selectedPayers, totalMinor, payerAmounts);
                  return (
                    <View key={payerId} style={styles.reviewRow}>
                      <ThemedText variant="bodyMedium">{nameForParticipant(payerId)}</ThemedText>
                      <ThemedText variant="amountSm" tone={paid > 0 ? "ink" : "muted"}>
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
                      <ThemedText variant="amountSm" tone={share > 0 ? "ink" : "muted"}>
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

                {summaryBalances.length > 0 ? (
                  <>
                    <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />
                    <ThemedText variant="caption" tone="muted" style={styles.reviewSubhead}>
                      Balance
                    </ThemedText>
                    {summaryBalances.map(({ participantId, netMinor }) => (
                      <View key={participantId} style={styles.reviewRow}>
                        <ThemedText variant="bodyMedium">{nameForParticipant(participantId)}</ThemedText>
                        <View style={styles.balanceAmountCol}>
                          <ThemedText
                            variant="amountSm"
                            tone={netMinor > 0 ? "confirmed" : netMinor < 0 ? "owe" : "muted"}
                          >
                            {formatSignedMoney(netMinor)}
                          </ThemedText>
                          <ThemedText variant="caption" tone={netMinor > 0 ? "confirmed" : netMinor < 0 ? "owe" : "muted"}>
                            {netMinor > 0 ? "gets back" : netMinor < 0 ? "owes" : "even"}
                          </ThemedText>
                        </View>
                      </View>
                    ))}
                  </>
                ) : null}

                <View style={[styles.statusBarTrack, { backgroundColor: theme.colors.hairline, borderRadius: theme.radius.full }]}>
                  <View
                    style={[
                      styles.statusBarFill,
                      {
                        width: `${balanced ? 100 : Math.max(12, Math.min(88, Math.round((payerTotalMinor / Math.max(totalMinor, 1)) * 100)))}%`,
                        backgroundColor: balanced ? theme.colors.confirmed : theme.colors.info,
                        borderRadius: theme.radius.full
                      }
                    ]}
                  />
                </View>
                {computedShares.residualMinor > 0 ? (
                  <ThemedText variant="bodySm" tone="muted">
                    {formatMoney(computedShares.residualMinor)} auto-rounded across shares (largest remainder).
                  </ThemedText>
                ) : null}
              </View>
            </DataSurface>
          </View>

          {message ? (
            <InlineNotice
              title="Expense status"
              body={message}
              tone={
                message.includes("offline") || message.includes("queue")
                  ? "pending"
                  : message.includes("failed") || message.includes("required") || message.includes("Could not")
                    ? "owe"
                    : "confirmed"
              }
            />
          ) : null}
          {queuedOffline ? (
            <Button label="Open sync queue" variant="secondary" onPress={() => navigation.go("offline")} />
          ) : null}
          {!description.trim() && !queuedOffline ? (
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
            label={
              queuedOffline
                ? "Already queued for sync"
                : isEditing
                  ? "Save expense changes"
                  : "Review and post expense"
            }
            onPress={submit}
            loading={submitting}
            disabled={
              queuedOffline ||
              submitting ||
              !balanced ||
              !description.trim() ||
              isVoided ||
              (isEditing && (!canManageExpense || !reason.trim()))
            }
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
    <CalculatorModal
      visible={calculatorVisible}
      initialValue={amount}
      onClose={() => setCalculatorVisible(false)}
      onApply={(value) => {
        markFormDirty();
        setAmount(value);
      }}
    />
    </>
  );
}

function payerPaidMinor(
  participantId: string,
  selectedPayers: string[],
  totalMinor: number,
  payerAmounts: Record<string, string>
): number {
  if (!selectedPayers.includes(participantId)) {
    return 0;
  }
  if (selectedPayers.length === 1) {
    return totalMinor;
  }
  return parseAmountToMinor(payerAmounts[participantId] ?? "");
}

function adjustmentAmountMinor(adjustment: DraftAdjustment): number {
  const amount = parseAmountToMinor(adjustment.amount);
  return adjustment.adjustmentType === "discount" ? -Math.abs(amount) : amount;
}

function itemizedTotalMinor(lineItems: DraftLineItem[], adjustments: DraftAdjustment[]) {
  const lineTotal = lineItems.reduce((total, line) => total + parseAmountToMinor(line.amount), 0);
  const adjustmentTotal = adjustments.reduce((total, adjustment) => total + adjustmentAmountMinor(adjustment), 0);

  return Math.max(0, lineTotal + adjustmentTotal);
}

function allocateByWeight(totalMinor: number, ids: string[], weights: Record<string, number>) {
  const sign = totalMinor < 0 ? -1 : 1;
  const absoluteTotalMinor = Math.abs(totalMinor);
  const totalWeight = ids.reduce((total, id) => total + Math.max(0, weights[id] ?? 1), 0);
  if (!ids.length || !totalWeight) {
    return { allocations: {}, residualMinor: 0 };
  }

  const rows = ids.map((id) => {
    const raw = (absoluteTotalMinor * Math.max(0, weights[id] ?? 1)) / totalWeight;
    const floor = Math.floor(raw);
    return { id, floor, remainder: raw - floor };
  });
  let remainingMinor = absoluteTotalMinor - rows.reduce((total, row) => total + row.floor, 0);
  const autoRoundedMinor = remainingMinor;
  rows
    .sort((a, b) => b.remainder - a.remainder || a.id.localeCompare(b.id))
    .forEach((row) => {
      if (remainingMinor > 0) {
        row.floor += 1;
        remainingMinor -= 1;
      }
    });

  return {
    allocations: Object.fromEntries(rows.map((row) => [row.id, row.floor * sign])),
    residualMinor: autoRoundedMinor
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
    return { allocations: {} as Record<string, number>, residualMinor: 0 };
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
    const adjustmentMinor = adjustments.reduce((total, adjustment) => total + adjustmentAmountMinor(adjustment), 0);
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
      amountMinor: adjustmentAmountMinor(adjustment),
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
    amount: minorToAmountInput(
      adjustment.adjustmentType === "discount" ? Math.abs(adjustment.amountMinor) : adjustment.amountMinor
    )
  }));
  setters.setAdjustments(nextAdjustments);
  setters.setShowAdjustments(nextAdjustments.length > 0);
}

const styles = StyleSheet.create({
  headerTitle: {
    flex: 1,
    gap: 6
  },
  groupTag: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    maxWidth: "100%"
  },
  headerButton: {
    flexShrink: 0
  },
  queueChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1
  },
  amountHero: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14
  },
  amountHeroCopy: {
    flex: 1,
    gap: 4
  },
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2
  },
  currencyPrefix: {
    marginTop: 2
  },
  amountInput: {
    flex: 1,
    padding: 0,
    minHeight: 40
  },
  calcChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    marginTop: 4
  },
  descriptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  descriptionInput: {
    flex: 1,
    padding: 0,
    minHeight: 24
  },
  categoryRow: {
    gap: 8,
    paddingRight: 8
  },
  categoryChip: {
    minWidth: 78,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1
  },
  metaRow: {
    flexDirection: "row",
    gap: 8
  },
  metaChip: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderWidth: 1
  },
  notesBlock: {
    gap: 8,
    padding: 14
  },
  notesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  notesInput: {
    minHeight: 56,
    padding: 0,
    textAlignVertical: "top"
  },
  formBlock: {
    gap: 10,
    padding: 12
  },
  itemizeComposer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12
  },
  expandedPickerSurface: {
    overflow: "visible",
    zIndex: 30
  },
  itemizeField: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 12
  },
  itemizeInput: {
    padding: 0,
    minHeight: 42
  },
  itemizeAmountField: {
    width: 92,
    minHeight: 44,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    flexShrink: 0
  },
  itemizeAmountInput: {
    flex: 1,
    padding: 0,
    minHeight: 42,
    textAlign: "right"
  },
  itemizeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1
  },
  itemizeRowCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0
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
  dataRowCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  iconActionButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  reviewBlock: {
    gap: 8,
    padding: 14
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  balanceAmountCol: {
    alignItems: "flex-end",
    gap: 2
  },
  reviewSubhead: {
    marginTop: 4
  },
  divider: {
    height: 1,
    marginVertical: 6
  },
  statusBarTrack: {
    height: 4,
    marginTop: 8,
    overflow: "hidden"
  },
  statusBarFill: {
    height: 4
  }
});
