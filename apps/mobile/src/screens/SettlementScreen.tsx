import React, { useEffect, useMemo, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CaretDown, CaretUp, CheckCircle, ImageSquare, QrCode, ShieldCheck, X } from "phosphor-react-native";
import QRCode from "react-native-qrcode-svg";

import { apiClient } from "../api/client";
import { useOptionalAppDialog } from "../components/AppDialog";
import { Button } from "../components/Button";
import { DataSurface } from "../components/DataSurface";
import { EmptyState } from "../components/EmptyState";
import { GroupSelector } from "../components/GroupSelector";
import { InlineNotice } from "../components/InlineNotice";
import { InputField } from "../components/InputField";
import { NumericKeypad } from "../components/NumericKeypad";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { SegmentedControl } from "../components/SegmentedControl";
import { SettlementStepper } from "../components/SettlementStepper";
import { StatusPill } from "../components/StatusPill";
import { ThemedText } from "../components/ThemedText";
import { useTheme } from "../theme";
import { SettlementIntent, SettlementState, SettlementSuggestion } from "../types/domain";
import { AppNavigation } from "../types/navigation";
import { formatMoney, parseAmountToMinor } from "../utils/money";
import { buildGroupDisplayLookups, enrichSettlementSuggestions, resolveParticipantDisplayName, formatSettlementHistoryLabel } from "../utils/displayNames";
import { activeGroupParticipants } from "../utils/groupPeople";
import { openAuthenticatedAttachment } from "../utils/authenticatedAttachment";
import {
  detectInstalledUpiApps,
  DetectedUpiApps,
  openUpiWithApp,
  UpiAppId,
  UpiAppOption
} from "../utils/upiApps";

type SettlementMode = "suggested" | "custom";
type PaymentMethod = "cash" | "upi";

const CONFIRMABLE_STATES: SettlementState[] = [
  "awaiting_receiver_confirmation",
  "auto_matched",
  "disputed",
  "partial_detected",
  "duplicate_reference_review"
];

const WAITING_FOR_PAYER_STATES: SettlementState[] = [
  "intent_created",
  "intent_generated",
  "payer_opened_upi_app",
  "awaiting_payment_evidence"
];

const SETTLED_STATES: SettlementState[] = ["confirmed", "ledger_posted"];

function isConfirmableState(state: SettlementState | undefined): boolean {
  return Boolean(state && CONFIRMABLE_STATES.includes(state));
}

export function SettlementScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const dialog = useOptionalAppDialog();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<SettlementMode>("suggested");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("upi");
  const [selectedSuggestion, setSelectedSuggestion] = useState<SettlementSuggestion>();
  const [customAmount, setCustomAmount] = useState("");
  const [payerParticipantId, setPayerParticipantId] = useState("");
  const [payeeParticipantId, setPayeeParticipantId] = useState("");
  const [payeeVpa, setPayeeVpa] = useState("");
  const [intent, setIntent] = useState<SettlementIntent>();
  const [utrText, setUtrText] = useState("");
  const [proofAttachment, setProofAttachment] = useState<{ id: string; name: string }>();
  const [reason, setReason] = useState("");
  const [handoffError, setHandoffError] = useState<string>();
  const [upiApps, setUpiApps] = useState<DetectedUpiApps>({ installed: [], notInstalled: [] });
  const [showOtherUpiApps, setShowOtherUpiApps] = useState(false);
  const [proofPreviewUri, setProofPreviewUri] = useState<string>();
  const [proofLoading, setProofLoading] = useState(false);

  const profileQuery = useQuery({ queryKey: ["me"], queryFn: () => apiClient.getMe() });
  const groupsQuery = useQuery({ queryKey: ["groups"], queryFn: () => apiClient.listGroups() });
  const groups = groupsQuery.data ?? [];
  const selectedGroupId = navigation.selectedGroupId ?? groups[0]?.id;
  const groupQuery = useQuery({
    queryKey: ["group", selectedGroupId],
    queryFn: () => apiClient.getGroup(selectedGroupId as string),
    enabled: Boolean(selectedGroupId)
  });
  const suggestionsQuery = useQuery({
    queryKey: ["settlementSuggestions", selectedGroupId],
    queryFn: () => apiClient.getSettlementSuggestions(selectedGroupId as string),
    enabled: Boolean(selectedGroupId)
  });
  const historyQuery = useQuery({
    queryKey: ["settlementHistory", selectedGroupId],
    queryFn: () => apiClient.listSettlementHistory(selectedGroupId as string),
    enabled: Boolean(selectedGroupId)
  });

  const myParticipantId = useMemo(
    () => groupQuery.data?.memberships.find((membership) => membership.userId === profileQuery.data?.id)?.participantId,
    [groupQuery.data?.memberships, profileQuery.data?.id]
  );

  useEffect(() => {
    let cancelled = false;
    void detectInstalledUpiApps().then((detected) => {
      if (!cancelled) {
        setUpiApps(detected);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!navigation.selectedGroupId && groups[0]?.id) {
      navigation.setSelectedGroupId(groups[0].id);
    }
  }, [groups, navigation]);

  const lookups = useMemo(() => (groupQuery.data ? buildGroupDisplayLookups(groupQuery.data) : undefined), [groupQuery.data]);
  const suggestions = useMemo(
    () => (suggestionsQuery.data && lookups ? enrichSettlementSuggestions(suggestionsQuery.data, lookups) : suggestionsQuery.data ?? []),
    [lookups, suggestionsQuery.data]
  );
  const payableSuggestions = useMemo(
    () => (myParticipantId ? suggestions.filter((row) => row.payerParticipantId === myParticipantId) : []),
    [myParticipantId, suggestions]
  );
  const receivableSuggestions = useMemo(
    () => (myParticipantId ? suggestions.filter((row) => row.payeeParticipantId === myParticipantId) : []),
    [myParticipantId, suggestions]
  );

  function resolvePayeeDefaultVpa(payeeId: string | undefined): string {
    if (!payeeId || !groupQuery.data?.participants) {
      return "";
    }
    return groupQuery.data.participants.find((participant) => participant.id === payeeId)?.upiVpa?.trim() ?? "";
  }

  // When the group changes, drop stale suggestion/intent/custom draft so amounts refresh.
  useEffect(() => {
    setSelectedSuggestion(undefined);
    setIntent(undefined);
    setCustomAmount("");
    setPayerParticipantId("");
    setPayeeParticipantId("");
    setPayeeVpa("");
    setUtrText("");
    setProofAttachment(undefined);
    setReason("");
    setHandoffError(undefined);
    setShowOtherUpiApps(false);
  }, [selectedGroupId]);

  // Current user is always the payer for custom settlements they create.
  useEffect(() => {
    if (myParticipantId) {
      setPayerParticipantId(myParticipantId);
    }
  }, [myParticipantId, selectedGroupId]);

  // Resume open settlements for the current member (payer handoff or payee confirmation).
  useEffect(() => {
    if (intent || !myParticipantId || !historyQuery.data?.length) {
      return;
    }
    const openForMe = historyQuery.data.find((row) => {
      if (row.paymentMethod === "cash") {
        return false;
      }
      if (["ledger_posted", "confirmed", "rejected", "cancelled", "expired", "reversed", "refunded"].includes(row.state)) {
        return false;
      }
      if (row.payeeParticipantId === myParticipantId && isConfirmableState(row.state)) {
        return true;
      }
      if (
        row.payerParticipantId === myParticipantId &&
        ["intent_created", "intent_generated", "payer_opened_upi_app", "awaiting_payment_evidence", "proof_submitted"].includes(
          row.state
        )
      ) {
        return true;
      }
      return false;
    });
    if (openForMe) {
      setIntent(openForMe);
    }
  }, [historyQuery.data, intent, myParticipantId]);

  useEffect(() => {
    if (!payableSuggestions.length) {
      setSelectedSuggestion(undefined);
      return;
    }
    setSelectedSuggestion((current) => {
      if (current && payableSuggestions.some((row) => row.id === current.id)) {
        return current;
      }
      return payableSuggestions[0];
    });
  }, [payableSuggestions]);

  // Prefill payee UPI from the receiver's saved default receive ID.
  useEffect(() => {
    if (intent) {
      return;
    }
    const payeeId =
      mode === "suggested" ? selectedSuggestion?.payeeParticipantId : payeeParticipantId;
    const defaultVpa = resolvePayeeDefaultVpa(payeeId);
    if (defaultVpa) {
      setPayeeVpa(defaultVpa);
    }
  }, [intent, mode, selectedSuggestion?.payeeParticipantId, payeeParticipantId, groupQuery.data?.participants]);

  const isPayer = Boolean(intent && myParticipantId && intent.payerParticipantId === myParticipantId);
  const isPayee = Boolean(intent && myParticipantId && intent.payeeParticipantId === myParticipantId);
  const canConfirmAsPayee = isPayee && isConfirmableState(intent?.state);
  const isSettled = Boolean(intent?.state && SETTLED_STATES.includes(intent.state));
  const waitingForPayerProof =
    isPayee && Boolean(intent?.state && WAITING_FOR_PAYER_STATES.includes(intent.state)) && !isConfirmableState(intent?.state);
  const canSubmitProofAsPayer =
    isPayer &&
    intent?.paymentMethod !== "cash" &&
    !SETTLED_STATES.includes(intent?.state as SettlementState) &&
    !["rejected", "cancelled", "expired"].includes(intent?.state ?? "");
  const awaitingPayeeConfirm = isPayer && isConfirmableState(intent?.state);

  const invalidateSettlementBalances = (groupId: string) => {
    void queryClient.invalidateQueries({ queryKey: ["groups"] });
    void queryClient.invalidateQueries({ queryKey: ["group", groupId] });
    void queryClient.invalidateQueries({ queryKey: ["balances", groupId] });
    void queryClient.invalidateQueries({ queryKey: ["settlementSuggestions", groupId] });
    void queryClient.invalidateQueries({ queryKey: ["settlementHistory", groupId] });
  };

  const createIntent = useMutation({
    mutationFn: () => {
      if (!selectedGroupId) {
        throw new Error("Select a group first");
      }
      if (!myParticipantId) {
        throw new Error("Your membership in this group could not be resolved.");
      }
      const payeeName =
        mode === "custom" && lookups ? resolveParticipantDisplayName(payeeParticipantId, lookups) : undefined;
      const payload =
        mode === "suggested" && selectedSuggestion
          ? {
              groupId: selectedGroupId,
              payerParticipantId: myParticipantId,
              payeeParticipantId: selectedSuggestion.payeeParticipantId,
              amountMinor: selectedSuggestion.amountMinor,
              currencyCode: selectedSuggestion.currencyCode,
              suggestionId: selectedSuggestion.id,
              paymentMethod,
              payeeVpa: paymentMethod === "upi" ? payeeVpa.trim() || undefined : undefined,
              payeeName: selectedSuggestion.payeeName
            }
          : {
              groupId: selectedGroupId,
              payerParticipantId: myParticipantId,
              payeeParticipantId,
              amountMinor: parseAmountToMinor(customAmount),
              currencyCode: "INR",
              paymentMethod,
              payeeVpa: paymentMethod === "upi" ? payeeVpa.trim() || undefined : undefined,
              payeeName
            };

      if (payload.payerParticipantId !== myParticipantId) {
        throw new Error("You can only pay settlements that you owe.");
      }
      if (mode === "suggested" && selectedSuggestion && selectedSuggestion.payerParticipantId !== myParticipantId) {
        throw new Error("This settlement is owed by someone else.");
      }

      return apiClient.createSettlementIntent(payload);
    },
    onSuccess: (response) => {
      setIntent(response);
      if (response.paymentMethod === "cash" || response.state === "ledger_posted") {
        invalidateSettlementBalances(response.groupId);
        setSelectedSuggestion(undefined);
      } else {
        void queryClient.invalidateQueries({ queryKey: ["settlementHistory", response.groupId] });
      }
    }
  });

  const submitProof = useMutation({
    mutationFn: () => {
      if (!intent) {
        throw new Error("Create a settlement intent first");
      }
      return apiClient.submitSettlementProof(intent.id, {
        utrText,
        attachmentId: proofAttachment?.id,
        claimedAmountMinor: intent.amountMinor
      });
    },
    onSuccess: (response) => {
      setIntent(response);
      queryClient.invalidateQueries({ queryKey: ["settlementHistory", selectedGroupId] });
    }
  });

  const uploadProof = useMutation({
    mutationFn: async () => {
      const result = await DocumentPicker.getDocumentAsync({ type: ["image/*", "application/pdf"], copyToCacheDirectory: true });
      if (result.canceled) {
        throw new Error("No proof selected");
      }
      const asset = result.assets[0];
      const attachment = await apiClient.uploadAttachment(
        {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType ?? "application/octet-stream"
        },
        "payment_proof"
      );
      return { id: attachment.id, name: asset.name };
    },
    onSuccess: setProofAttachment
  });

  const confirm = useMutation({
    mutationFn: () => apiClient.confirmSettlement(intent?.id as string),
    onSuccess: (response) => {
      setIntent(response);
      invalidateSettlementBalances(response.groupId);
      dialog?.showDialog({
        title: "Payment confirmed",
        message: "Settlement is complete. Balances have been updated.",
        tone: "success",
        primaryAction: {
          label: "Done",
          onPress: () => {
            setIntent(undefined);
            setReason("");
            setUtrText("");
            setProofAttachment(undefined);
          }
        }
      });
    }
  });
  const reject = useMutation({
    mutationFn: () => apiClient.rejectSettlement(intent?.id as string, reason),
    onSuccess: (response) => {
      setIntent(response);
      void queryClient.invalidateQueries({ queryKey: ["settlementHistory", selectedGroupId] });
    }
  });
  const dispute = useMutation({
    mutationFn: () => apiClient.disputeSettlement(intent?.id as string, reason),
    onSuccess: setIntent
  });

  const openUpi = async (appId: UpiAppId) => {
    if (!intent?.upiUri) {
      return;
    }
    try {
      setHandoffError(undefined);
      await openUpiWithApp(appId, intent.upiUri);
      const updated = await apiClient.markUpiOpened(intent.id, appId === "other" ? "other" : appId);
      setIntent(updated);
    } catch (error) {
      setHandoffError(error instanceof Error ? error.message : String(error));
    }
  };

  const renderUpiAppButton = (app: UpiAppOption | { id: UpiAppId; label: string; brandColor: string }) => (
    <Pressable
      key={app.id}
      onPress={() => void openUpi(app.id)}
      style={[styles.upiApp, { borderColor: theme.colors.hairline, borderRadius: theme.radius.md }]}
    >
      <View style={[styles.upiBadge, { backgroundColor: app.brandColor }]}>
        <ThemedText variant="caption" style={styles.upiBadgeText}>
          {app.label.slice(0, 2).toUpperCase()}
        </ThemedText>
      </View>
      <ThemedText variant="caption" numberOfLines={1}>
        {app.label}
      </ThemedText>
    </Pressable>
  );

  const canCreateCustom =
    Boolean(myParticipantId) &&
    Boolean(payeeParticipantId) &&
    payeeParticipantId !== myParticipantId &&
    parseAmountToMinor(customAmount) > 0;
  const selectedPayeeHasDefaultVpa = Boolean(
    resolvePayeeDefaultVpa(mode === "suggested" ? selectedSuggestion?.payeeParticipantId : payeeParticipantId)
  );
  const canCreateSuggested =
    Boolean(selectedSuggestion) &&
    selectedSuggestion?.payerParticipantId === myParticipantId &&
    (paymentMethod === "cash" || Boolean(payeeVpa.trim()) || selectedPayeeHasDefaultVpa);
  const canCreateUpi =
    paymentMethod === "cash" || Boolean(payeeVpa.trim()) || selectedPayeeHasDefaultVpa;
  const activeAmount = intent?.amountMinor ?? selectedSuggestion?.amountMinor ?? parseAmountToMinor(customAmount);
  const refreshing =
    groupsQuery.isRefetching || groupQuery.isRefetching || suggestionsQuery.isRefetching || historyQuery.isRefetching || profileQuery.isRefetching;

  async function refreshScreen() {
    await Promise.all([
      groupsQuery.refetch(),
      selectedGroupId ? groupQuery.refetch() : Promise.resolve(),
      selectedGroupId ? suggestionsQuery.refetch() : Promise.resolve(),
      selectedGroupId ? historyQuery.refetch() : Promise.resolve()
    ]);
  }

  async function openProof(row: SettlementIntent) {
    const pathOrUrl = row.proofUrl ?? (row.proofAttachmentId ? `/v1/attachments/${row.proofAttachmentId}/content` : null);
    if (!pathOrUrl) {
      return;
    }
    setProofLoading(true);
    try {
      const file = await openAuthenticatedAttachment(pathOrUrl);
      if (file.isImage) {
        setProofPreviewUri(file.localUri);
      }
    } catch (error) {
      dialog?.showDialog({
        title: "Could not open proof",
        message: error instanceof Error ? error.message : "Download failed.",
        tone: "error",
        primaryAction: { label: "OK" }
      });
    } finally {
      setProofLoading(false);
    }
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refreshScreen()}>
      <View style={styles.header}>
        <View>
          <ThemedText variant="caption" tone="muted">
            {paymentMethod === "cash" ? "Cash settlement" : "UPI settlement"}
          </ThemedText>
          <ThemedText variant="title" numberOfLines={1}>{paymentMethod === "cash" ? "Mark cash payment" : "Proof before posted"}</ThemedText>
        </View>
        {intent ? <StatusPill state={intent.state} /> : null}
      </View>

      {groups.length ? <GroupSelector groups={groups} selectedGroupId={selectedGroupId} onSelect={navigation.setSelectedGroupId} /> : null}
      {!selectedGroupId ? <EmptyState title="No group selected" body="Select a group with balances before creating UPI settlement intents." /> : null}

      <DataSurface>
        <View style={styles.formBlock}>
          <SettlementStepper state={intent?.state} />
          <View style={styles.amountBlock}>
            <ThemedText variant="caption" tone="muted" align="center">
              Settlement amount
            </ThemedText>
            <ThemedText variant="balanceHero" align="center">
              {formatMoney(activeAmount)}
            </ThemedText>
          </View>
        </View>
      </DataSurface>

      {!intent ? (
        <View style={styles.section}>
          <SegmentedControl value={mode} options={[{ label: "Suggested", value: "suggested" }, { label: "Custom", value: "custom" }]} onChange={setMode} />
          <SegmentedControl
            value={paymentMethod}
            options={[{ label: "Pay via UPI", value: "upi" }, { label: "Paid in cash", value: "cash" }]}
            onChange={setPaymentMethod}
          />

          {mode === "suggested" ? (
            <View style={styles.section}>
              <SectionHeader title="You need to pay" />
              {suggestionsQuery.error ? <InlineNotice title="Suggestions could not load" body={suggestionsQuery.error.message} tone="owe" /> : null}
              {payableSuggestions.length ? (
                <DataSurface>
                  {payableSuggestions.map((suggestion) => (
                    <Pressable
                      key={suggestion.id}
                      onPress={() => {
                        setSelectedSuggestion(suggestion);
                        const defaultVpa = resolvePayeeDefaultVpa(suggestion.payeeParticipantId);
                        if (defaultVpa) {
                          setPayeeVpa(defaultVpa);
                        }
                      }}
                      style={[
                        styles.suggestion,
                        {
                          borderBottomColor: theme.colors.hairline,
                          borderColor: selectedSuggestion?.id === suggestion.id ? theme.colors.confirmed : "transparent"
                        }
                      ]}
                    >
                      <View style={styles.titleBlock}>
                        <ThemedText variant="bodyMedium">Pay {suggestion.payeeName}</ThemedText>
                        <ThemedText variant="bodySm" tone="muted">
                          {suggestion.explanation}
                        </ThemedText>
                      </View>
                      <ThemedText variant="amount">{formatMoney(suggestion.amountMinor, suggestion.currencyCode)}</ThemedText>
                    </Pressable>
                  ))}
                </DataSurface>
              ) : (
                <EmptyState title="Nothing to pay" body="You don’t currently owe anyone in this group." />
              )}

              {paymentMethod === "upi" && payableSuggestions.length ? (
                <View style={styles.section}>
                  <InputField
                    label="Receiver UPI ID"
                    value={payeeVpa}
                    onChangeText={setPayeeVpa}
                    autoCapitalize="none"
                    placeholder="name@okaxis"
                  />
                  <ThemedText variant="caption" tone="muted">
                    {selectedPayeeHasDefaultVpa
                      ? "Filled from their default receive UPI ID. Edit only if they asked you to use a different ID."
                      : "They haven’t saved a default UPI ID yet — ask them, or enter it here."}
                  </ThemedText>
                </View>
              ) : null}

              {payableSuggestions.length ? (
                <Button
                  label={paymentMethod === "cash" ? "Confirm cash payment" : "Create UPI payment"}
                  onPress={() => createIntent.mutate()}
                  loading={createIntent.isPending}
                  disabled={!canCreateSuggested || !canCreateUpi}
                />
              ) : null}

              {receivableSuggestions.length ? (
                <>
                  <SectionHeader title="Waiting to receive" />
                  <DataSurface>
                    {receivableSuggestions.map((suggestion) => (
                      <View key={suggestion.id} style={[styles.suggestion, { borderBottomColor: theme.colors.hairline, borderColor: "transparent" }]}>
                        <View style={styles.titleBlock}>
                          <ThemedText variant="bodyMedium">{suggestion.payerName} owes you</ThemedText>
                          <ThemedText variant="bodySm" tone="muted">
                            Only they can pay this. You’ll confirm after they send proof.
                          </ThemedText>
                        </View>
                        <ThemedText variant="amount">{formatMoney(suggestion.amountMinor, suggestion.currencyCode)}</ThemedText>
                      </View>
                    ))}
                  </DataSurface>
                </>
              ) : null}
            </View>
          ) : null}

          {mode === "custom" ? (
            <View style={styles.section}>
              <DataSurface>
                <View style={styles.formBlock}>
                  <ThemedText variant="bodyMedium">You are paying</ThemedText>
                  <ThemedText variant="bodySm" tone="muted">
                    Choose who receives the money. You can only settle what you owe.
                  </ThemedText>
                  {groupQuery.data
                    ? activeGroupParticipants(groupQuery.data)
                        .filter((participant) => participant.id !== myParticipantId)
                        .map((participant) => (
                      <Pressable
                        key={participant.id}
                        onPress={() => {
                          setPayeeParticipantId(participant.id);
                          const defaultVpa = participant.upiVpa?.trim() ?? "";
                          if (defaultVpa) {
                            setPayeeVpa(defaultVpa);
                          }
                        }}
                        style={[
                          styles.suggestion,
                          {
                            borderBottomColor: theme.colors.hairline,
                            borderColor: payeeParticipantId === participant.id ? theme.colors.confirmed : "transparent"
                          }
                        ]}
                      >
                        <View style={styles.titleBlock}>
                          <ThemedText variant="bodyMedium">{participant.displayName}</ThemedText>
                          <ThemedText variant="bodySm" tone="muted">
                            {participant.upiVpa?.trim() ? `UPI: ${participant.upiVpa}` : "No default UPI saved"}
                          </ThemedText>
                        </View>
                      </Pressable>
                    ))
                    : null}
                  <InputField label="Amount" value={customAmount} onChangeText={setCustomAmount} keyboardType="decimal-pad" amount />
                  {paymentMethod === "upi" ? (
                    <>
                      <InputField
                        label="Receiver UPI ID"
                        value={payeeVpa}
                        onChangeText={setPayeeVpa}
                        autoCapitalize="none"
                        placeholder="name@okaxis"
                      />
                      <ThemedText variant="caption" tone="muted">
                        {selectedPayeeHasDefaultVpa
                          ? "Filled from their profile. Change only if needed."
                          : "Enter their UPI ID, or ask them to save one in Profile."}
                      </ThemedText>
                    </>
                  ) : null}
                  <NumericKeypad
                    onKey={(key) => {
                      if (key === "backspace") {
                        setCustomAmount((value) => value.slice(0, -1));
                      } else {
                        setCustomAmount((value) => `${value}${key}`);
                      }
                    }}
                  />
                </View>
              </DataSurface>
              <Button
                label={paymentMethod === "cash" ? "Confirm cash payment" : "Create UPI payment"}
                onPress={() => createIntent.mutate()}
                loading={createIntent.isPending}
                disabled={!canCreateCustom || !canCreateUpi}
              />
            </View>
          ) : null}
        </View>
      ) : intent.paymentMethod === "cash" ? (
        <DataSurface>
          <View style={styles.formBlock}>
            <ThemedText variant="bodyMedium">Cash payment recorded</ThemedText>
            <ThemedText variant="bodySm" tone="muted">
              This settlement was immediately posted to the ledger. Balances have been updated.
            </ThemedText>
          </View>
        </DataSurface>
      ) : (
        <View style={styles.section}>
          {isPayer && !isSettled ? (
            <>
              <SectionHeader title="UPI handoff" />
              <DataSurface>
                <View style={styles.formBlock}>
                  <View style={styles.handoffRow}>
                    <QrCode size={24} color={theme.colors.confirmed} weight="duotone" />
                    <View style={styles.titleBlock}>
                      <ThemedText variant="bodyMedium">Pay with an installed UPI app</ThemedText>
                      <ThemedText variant="bodySm" tone="muted">
                        Only apps detected on this phone are listed. Use Other for apps we could not detect.
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.appRow}>
                    {upiApps.installed.map((app) => renderUpiAppButton(app))}
                    <Pressable
                      onPress={() => setShowOtherUpiApps((value) => !value)}
                      style={[styles.upiApp, { borderColor: theme.colors.hairline, borderRadius: theme.radius.md }]}
                    >
                      <View style={[styles.upiBadge, { backgroundColor: theme.colors.inkMuted }]}>
                        {showOtherUpiApps ? (
                          <CaretUp size={14} color="#fff" weight="bold" />
                        ) : (
                          <CaretDown size={14} color="#fff" weight="bold" />
                        )}
                      </View>
                      <ThemedText variant="caption">Other</ThemedText>
                    </Pressable>
                  </View>
                  {showOtherUpiApps ? (
                    <View style={styles.otherAppsBlock}>
                      <ThemedText variant="caption" tone="muted">
                        Not detected on this phone — tap to try opening anyway, or use Any UPI app / QR.
                      </ThemedText>
                      <View style={styles.appRow}>
                        {upiApps.notInstalled.map((app) => renderUpiAppButton(app))}
                        {renderUpiAppButton({ id: "other", label: "Any UPI app", brandColor: theme.colors.inkMuted })}
                      </View>
                    </View>
                  ) : null}
                  {intent.qrPayload ? (
                    <View style={[styles.qrBox, { backgroundColor: theme.colors.ink, borderRadius: theme.radius.md }]}>
                      <QRCode value={intent.qrPayload} size={164} backgroundColor="transparent" color={theme.colors.canvas} />
                    </View>
                  ) : null}
                </View>
              </DataSurface>

              {canSubmitProofAsPayer ? (
                <>
                  <SectionHeader title="Payment proof" />
                  <DataSurface>
                    <View style={styles.formBlock}>
                      <ThemedText variant="bodySm" tone="muted">
                        After you pay, add UTR and/or a screenshot. The receiver must confirm before this settles.
                      </ThemedText>
                      <InputField label="UTR or UPI reference" value={utrText} onChangeText={setUtrText} autoCapitalize="characters" />
                      <Button
                        label={proofAttachment ? `Proof attached: ${proofAttachment.name}` : "Attach screenshot or PDF"}
                        variant="secondary"
                        onPress={() => uploadProof.mutate()}
                        loading={uploadProof.isPending}
                      />
                      <Button
                        label="Submit proof"
                        onPress={() => submitProof.mutate()}
                        loading={submitProof.isPending}
                        disabled={!utrText.trim() && !proofAttachment}
                      />
                    </View>
                  </DataSurface>
                </>
              ) : null}

              {awaitingPayeeConfirm ? (
                <InlineNotice
                  title="Waiting for receiver confirmation"
                  body="Proof submitted. Only the person receiving the money can confirm — then balances update."
                  tone="pending"
                />
              ) : null}
            </>
          ) : null}

          {canConfirmAsPayee ? (
            <>
              <SectionHeader title="Confirm you received payment" />
              <DataSurface>
                <View style={styles.formBlock}>
                  <View style={styles.handoffRow}>
                    <ShieldCheck size={24} color={theme.colors.confirmed} weight="duotone" />
                    <View style={styles.titleBlock}>
                      <ThemedText variant="bodyMedium">Verify before you confirm</ThemedText>
                      <ThemedText variant="bodySm" tone="muted">
                        Confirm only after the money has arrived in your account.
                      </ThemedText>
                    </View>
                    {(intent.proofAttachmentId || intent.proofUrl || intent.proofs?.length) ? (
                      <Pressable
                        onPress={() => void openProof(intent)}
                        disabled={proofLoading}
                        accessibilityRole="button"
                        accessibilityLabel="View payment proof"
                        style={({ pressed }) => [
                          styles.proofIconButton,
                          {
                            borderColor: theme.colors.hairline,
                            backgroundColor: theme.colors.canvas,
                            opacity: proofLoading || pressed ? 0.7 : 1
                          }
                        ]}
                      >
                        <ImageSquare size={22} color={theme.colors.confirmed} weight="duotone" />
                      </Pressable>
                    ) : null}
                  </View>
                  {!(intent.proofAttachmentId || intent.proofUrl || intent.proofs?.length) ? (
                    <InlineNotice
                      title="No screenshot attached"
                      body="The payer submitted a UTR reference. Confirm if the amount matches your bank credit."
                      tone="info"
                    />
                  ) : null}
                  <InputField label="Reject reason (required to reject)" value={reason} onChangeText={setReason} />
                  <View style={styles.choiceButtons}>
                    <Button
                      label="Confirm"
                      size="compact"
                      onPress={() => confirm.mutate()}
                      loading={confirm.isPending}
                      style={styles.inlineButton}
                    />
                    <Button
                      label="Reject"
                      size="compact"
                      variant="destructive"
                      onPress={() => reject.mutate()}
                      loading={reject.isPending}
                      disabled={!reason.trim()}
                      style={styles.inlineButton}
                    />
                  </View>
                  <Button
                    label="Open dispute"
                    size="compact"
                    variant="ghost"
                    onPress={() => dispute.mutate()}
                    loading={dispute.isPending}
                    disabled={!reason.trim()}
                  />
                </View>
              </DataSurface>
            </>
          ) : null}

          {isSettled ? (
            <DataSurface>
              <View style={styles.formBlock}>
                <View style={styles.handoffRow}>
                  <CheckCircle size={24} color={theme.colors.confirmed} weight="duotone" />
                  <View style={styles.titleBlock}>
                    <ThemedText variant="bodyMedium">Settlement complete</ThemedText>
                    <ThemedText variant="bodySm" tone="muted">
                      Payment was confirmed and balances are updated.
                    </ThemedText>
                  </View>
                </View>
                <Button
                  label="Start another settlement"
                  variant="secondary"
                  onPress={() => {
                    setIntent(undefined);
                    setReason("");
                    setUtrText("");
                    setProofAttachment(undefined);
                  }}
                />
              </View>
            </DataSurface>
          ) : null}

          {intent?.state === "rejected" ? (
            <InlineNotice
              title="Payment rejected"
              body={intent.rejectionReason ? `Reason: ${intent.rejectionReason}` : "The receiver rejected this payment claim."}
              tone="owe"
            />
          ) : null}

          {intent?.state === "disputed" ? (
            <InlineNotice
              title="Payment disputed"
              body={intent.rejectionReason ? `Reason: ${intent.rejectionReason}` : "This settlement is under dispute."}
              tone="owe"
            />
          ) : null}

          {waitingForPayerProof ? (
            <InlineNotice
              title="Waiting for payer"
              body="The payer still needs to complete UPI and submit proof before you can confirm."
              tone="info"
            />
          ) : null}
        </View>
      )}

      <Modal visible={Boolean(proofPreviewUri)} transparent animationType="fade" onRequestClose={() => setProofPreviewUri(undefined)}>
        <View style={styles.proofModalRoot}>
          <Pressable style={styles.proofModalBackdrop} onPress={() => setProofPreviewUri(undefined)} />
          <View style={[styles.proofModalCard, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg }]}>
            <View style={styles.proofModalHeader}>
              <ThemedText variant="bodyMedium">Payment proof</ThemedText>
              <Pressable onPress={() => setProofPreviewUri(undefined)} hitSlop={12}>
                <X size={22} color={theme.colors.ink} weight="bold" />
              </Pressable>
            </View>
            {proofPreviewUri ? (
              <Image source={{ uri: proofPreviewUri }} style={styles.proofImage} resizeMode="contain" />
            ) : null}
            <Button label="Close" variant="secondary" onPress={() => setProofPreviewUri(undefined)} />
          </View>
        </View>
      </Modal>

      <View style={styles.section}>
        <SectionHeader title="Settlement history" />
        {historyQuery.error ? <InlineNotice title="History could not load" body={historyQuery.error.message} tone="owe" /> : null}
        {historyQuery.data?.length ? (
          <DataSurface>
            {historyQuery.data.map((row) => {
              const rowIsPayee = Boolean(myParticipantId && row.payeeParticipantId === myParticipantId);
              const rowCanConfirm = rowIsPayee && row.paymentMethod !== "cash" && isConfirmableState(row.state);
              const hasProof = Boolean(row.proofAttachmentId || row.proofUrl);
              return (
                <View key={row.id} style={[styles.historyRow, { borderBottomColor: theme.colors.hairline }]}>
                  <View style={styles.titleBlock}>
                    <ThemedText variant="bodyMedium">
                      {lookups ? formatSettlementHistoryLabel(row, lookups) : row.clientReference ?? "Settlement"}
                    </ThemedText>
                    <ThemedText variant="bodySm" tone="muted">
                      {row.createdAt ? new Date(row.createdAt).toLocaleString() : "Settlement intent"}
                    </ThemedText>
                    {row.state === "rejected" && row.rejectionReason ? (
                      <ThemedText variant="bodySm" tone="owe">
                        Rejected: {row.rejectionReason}
                      </ThemedText>
                    ) : null}
                    {row.state === "disputed" && row.rejectionReason ? (
                      <ThemedText variant="bodySm" tone="owe">
                        Dispute: {row.rejectionReason}
                      </ThemedText>
                    ) : null}
                    {rowCanConfirm ? (
                      <Button
                        label={intent?.id === row.id ? "Reviewing above" : "Review"}
                        size="compact"
                        variant="secondary"
                        onPress={() => setIntent(row)}
                        style={styles.historyReviewButton}
                      />
                    ) : null}
                  </View>
                  <View style={styles.trailing}>
                    {hasProof ? (
                      <Pressable
                        onPress={() => void openProof(row)}
                        disabled={proofLoading}
                        accessibilityRole="button"
                        accessibilityLabel="View payment proof"
                        hitSlop={8}
                        style={({ pressed }) => [
                          styles.proofIconButton,
                          {
                            borderColor: theme.colors.hairline,
                            backgroundColor: theme.colors.canvas,
                            opacity: proofLoading || pressed ? 0.7 : 1
                          }
                        ]}
                      >
                        <ImageSquare size={18} color={theme.colors.inkMuted} weight="duotone" />
                      </Pressable>
                    ) : null}
                    <ThemedText variant="amount">{formatMoney(row.amountMinor, row.currencyCode)}</ThemedText>
                    <StatusPill state={row.state} />
                  </View>
                </View>
              );
            })}
          </DataSurface>
        ) : (
          <EmptyState title="No settlement history" body="UPI app opens, proofs, confirmations, and postings will appear here." />
        )}
      </View>

      {createIntent.error ? <InlineNotice title="Intent failed" body={createIntent.error.message} tone="owe" /> : null}
      {handoffError ? <InlineNotice title="UPI handoff unavailable" body={handoffError} tone="pending" /> : null}
      {intent?.upiUri ? (
        <InlineNotice title="UPI fallback" body="If app handoff is unavailable on this simulator/device, scan the QR from a UPI app." tone="info" />
      ) : null}
      {uploadProof.error ? <InlineNotice title="Attachment failed" body={uploadProof.error.message} tone="owe" /> : null}
      {submitProof.error ? <InlineNotice title="Proof failed" body={submitProof.error.message} tone="owe" /> : null}
    </Screen>
  );
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
    gap: 14,
    padding: 14
  },
  amountBlock: {
    gap: 6
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderWidth: 1
  },
  titleBlock: {
    flex: 1,
    gap: 4
  },
  participantChoice: {
    gap: 8
  },
  choiceButtons: {
    flexDirection: "row",
    gap: 8
  },
  handoffRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center"
  },
  appRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  upiApp: {
    minWidth: 88,
    minHeight: 72,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 10
  },
  upiBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  upiBadgeText: {
    color: "#FFFFFF",
    fontWeight: "700"
  },
  otherAppsBlock: {
    gap: 10
  },
  qrBox: {
    alignSelf: "center",
    padding: 14
  },
  actionRow: {
    flexDirection: "row",
    gap: 10
  },
  inlineButton: {
    flex: 1
  },
  proofIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  historyReviewButton: {
    alignSelf: "flex-start",
    marginTop: 4
  },
  proofModalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 40
  },
  proofModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11, 14, 20, 0.72)"
  },
  proofModalCard: {
    zIndex: 1,
    padding: 16,
    gap: 14,
    maxHeight: "88%"
  },
  proofModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  proofImage: {
    width: "100%",
    height: 420,
    backgroundColor: "#0B0E14"
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderBottomWidth: 1
  },
  trailing: {
    alignItems: "flex-end",
    gap: 6
  }
});
