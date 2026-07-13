import React, { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DeviceMobile, PaperPlaneTilt, QrCode, ShieldCheck } from "phosphor-react-native";
import QRCode from "react-native-qrcode-svg";

import { apiClient } from "../api/client";
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
import { SettlementIntent, SettlementSuggestion } from "../types/domain";
import { AppNavigation } from "../types/navigation";
import { formatMoney, parseAmountToMinor } from "../utils/money";
import { buildGroupDisplayLookups, enrichSettlementSuggestions, resolveParticipantDisplayName, formatSettlementHistoryLabel } from "../utils/displayNames";

type SettlementMode = "suggested" | "custom";
type PaymentMethod = "cash" | "upi";

export function SettlementScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
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

  useEffect(() => {
    if (suggestions[0] && !selectedSuggestion) {
      setSelectedSuggestion(suggestions[0]);
    }
  }, [selectedSuggestion, suggestions]);

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
      const payeeName =
        mode === "custom" && lookups ? resolveParticipantDisplayName(payeeParticipantId, lookups) : undefined;
      const payload =
        mode === "suggested" && selectedSuggestion
          ? {
              groupId: selectedGroupId,
              payerParticipantId: selectedSuggestion.payerParticipantId,
              payeeParticipantId: selectedSuggestion.payeeParticipantId,
              amountMinor: selectedSuggestion.amountMinor,
              currencyCode: selectedSuggestion.currencyCode,
              suggestionId: selectedSuggestion.id,
              paymentMethod,
              payeeVpa: paymentMethod === "upi" ? payeeVpa : undefined,
              payeeName: selectedSuggestion.payeeName
            }
          : {
              groupId: selectedGroupId,
              payerParticipantId,
              payeeParticipantId,
              amountMinor: parseAmountToMinor(customAmount),
              currencyCode: "INR",
              paymentMethod,
              payeeVpa: paymentMethod === "upi" ? payeeVpa : undefined,
              payeeName
            };

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
    }
  });
  const reject = useMutation({
    mutationFn: () => apiClient.rejectSettlement(intent?.id as string, reason),
    onSuccess: setIntent
  });
  const dispute = useMutation({
    mutationFn: () => apiClient.disputeSettlement(intent?.id as string, reason),
    onSuccess: setIntent
  });

  const openUpi = async (appName: string) => {
    if (!intent?.upiUri) {
      return;
    }
    const canOpen = await Linking.canOpenURL(intent.upiUri);
    try {
      setHandoffError(undefined);
      if (!canOpen) {
        throw new Error("No UPI app is available for this simulator/device. Use QR or copy the UPI link.");
      }
      await Linking.openURL(intent.upiUri);
      const updated = await apiClient.markUpiOpened(intent.id, appName);
      setIntent(updated);
    } catch (error) {
      setHandoffError(error instanceof Error ? error.message : String(error));
    }
  };

  const canCreateCustom = payerParticipantId && payeeParticipantId && payerParticipantId !== payeeParticipantId && parseAmountToMinor(customAmount) > 0;
  const activeAmount = intent?.amountMinor ?? selectedSuggestion?.amountMinor ?? parseAmountToMinor(customAmount);

  return (
    <Screen>
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
              <SectionHeader title="Suggestions" action={<Button label="Explain" variant="ghost" onPress={() => navigation.go("balances")} />} />
              {suggestionsQuery.error ? <InlineNotice title="Suggestions could not load" body={suggestionsQuery.error.message} tone="owe" /> : null}
              {suggestionsQuery.data?.length ? (
                <DataSurface>
                  {suggestions.map((suggestion) => (
                    <Pressable
                      key={suggestion.id}
                      onPress={() => setSelectedSuggestion(suggestion)}
                      style={[
                        styles.suggestion,
                        {
                          borderBottomColor: theme.colors.hairline,
                          borderColor: selectedSuggestion?.id === suggestion.id ? theme.colors.confirmed : "transparent"
                        }
                      ]}
                    >
                      <View style={styles.titleBlock}>
                        <ThemedText variant="bodyMedium">
                          {suggestion.payerName} pays {suggestion.payeeName}
                        </ThemedText>
                        <ThemedText variant="bodySm" tone="muted">
                          {suggestion.explanation}
                        </ThemedText>
                      </View>
                      <ThemedText variant="amount">{formatMoney(suggestion.amountMinor, suggestion.currencyCode)}</ThemedText>
                    </Pressable>
                  ))}
                </DataSurface>
              ) : (
                <EmptyState title="No suggestion" body="The backend suggestion projection has no settlement route yet." />
              )}
              {paymentMethod === "upi" ? <InputField label="Payee UPI ID" value={payeeVpa} onChangeText={setPayeeVpa} autoCapitalize="none" /> : null}
              <Button
                label={paymentMethod === "cash" ? "Confirm cash payment" : "Create UPI intent"}
                onPress={() => createIntent.mutate()}
                loading={createIntent.isPending}
                disabled={!selectedSuggestion || (paymentMethod === "upi" && !payeeVpa.trim())}
              />
            </View>
          ) : null}

          {mode === "custom" ? (
            <View style={styles.section}>
              <DataSurface>
                <View style={styles.formBlock}>
                  <ThemedText variant="bodyMedium">Choose payer and payee</ThemedText>
                  {groupQuery.data?.participants.map((participant) => (
                    <View key={participant.id} style={styles.participantChoice}>
                      <ThemedText variant="bodyMedium">{participant.displayName}</ThemedText>
                      <View style={styles.choiceButtons}>
                        <Button label="Payer" variant={payerParticipantId === participant.id ? "primary" : "secondary"} onPress={() => setPayerParticipantId(participant.id)} />
                        <Button label="Payee" variant={payeeParticipantId === participant.id ? "primary" : "secondary"} onPress={() => setPayeeParticipantId(participant.id)} />
                      </View>
                    </View>
                  ))}
                  <InputField label="Amount" value={customAmount} onChangeText={setCustomAmount} keyboardType="decimal-pad" amount />
                  {paymentMethod === "upi" ? <InputField label="Payee UPI ID" value={payeeVpa} onChangeText={setPayeeVpa} autoCapitalize="none" /> : null}
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
                label={paymentMethod === "cash" ? "Confirm cash payment" : "Create UPI intent"}
                onPress={() => createIntent.mutate()}
                loading={createIntent.isPending}
                disabled={!canCreateCustom || (paymentMethod === "upi" && !payeeVpa.trim())}
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
          <SectionHeader title="UPI handoff" />
          <DataSurface>
            <View style={styles.formBlock}>
              <View style={styles.handoffRow}>
                <QrCode size={24} color={theme.colors.confirmed} weight="duotone" />
                <View style={styles.titleBlock}>
                  <ThemedText variant="bodyMedium">Payer-initiated transfer</ThemedText>
                  <ThemedText variant="bodySm" tone="muted">
                    Opening UPI is not payment confirmation. Add proof after transfer.
                  </ThemedText>
                </View>
              </View>
              <View style={styles.appRow}>
                {["gpay", "phonepe", "paytm", "bhim", "other"].map((appName) => (
                  <Pressable key={appName} onPress={() => openUpi(appName)} style={[styles.upiApp, { borderColor: theme.colors.hairline, borderRadius: theme.radius.md }]}>
                    <DeviceMobile size={20} color={theme.colors.inkMuted} weight="duotone" />
                    <ThemedText variant="caption">{appName}</ThemedText>
                  </Pressable>
                ))}
              </View>
              {intent.qrPayload ? (
                <View style={[styles.qrBox, { backgroundColor: theme.colors.ink, borderRadius: theme.radius.md }]}>
                  <QRCode value={intent.qrPayload} size={164} backgroundColor="transparent" color={theme.colors.canvas} />
                </View>
              ) : null}
            </View>
          </DataSurface>

          <SectionHeader title="Proof and confirmation" />
          <DataSurface>
            <View style={styles.formBlock}>
              <InputField label="UTR or UPI reference" value={utrText} onChangeText={setUtrText} autoCapitalize="characters" />
              <Button label={proofAttachment ? `Proof attached: ${proofAttachment.name}` : "Attach screenshot or PDF"} variant="secondary" onPress={() => uploadProof.mutate()} loading={uploadProof.isPending} />
              <Button label="Submit proof" onPress={() => submitProof.mutate()} loading={submitProof.isPending} disabled={!utrText.trim() && !proofAttachment} />
              <InputField label="Reject or dispute reason" value={reason} onChangeText={setReason} />
              <View style={styles.actionRow}>
                <Button label="Confirm received" onPress={() => confirm.mutate()} loading={confirm.isPending} style={styles.inlineButton} />
                <Button label="Reject" variant="destructive" onPress={() => reject.mutate()} loading={reject.isPending} disabled={!reason.trim()} style={styles.inlineButton} />
              </View>
              <Button label="Open dispute" variant="secondary" onPress={() => dispute.mutate()} loading={dispute.isPending} disabled={!reason.trim()} />
            </View>
          </DataSurface>
        </View>
      )}

      <View style={styles.section}>
        <SectionHeader title="Settlement history" />
        {historyQuery.error ? <InlineNotice title="History could not load" body={historyQuery.error.message} tone="owe" /> : null}
        {historyQuery.data?.length ? (
          <DataSurface>
            {historyQuery.data.map((row) => (
              <View key={row.id} style={[styles.historyRow, { borderBottomColor: theme.colors.hairline }]}>
                <View style={styles.titleBlock}>
                  <ThemedText variant="bodyMedium">
                    {lookups ? formatSettlementHistoryLabel(row, lookups) : row.clientReference ?? "Settlement"}
                  </ThemedText>
                  <ThemedText variant="bodySm" tone="muted">
                    {row.createdAt ? new Date(row.createdAt).toLocaleString() : "Settlement intent"}
                  </ThemedText>
                </View>
                <View style={styles.trailing}>
                  <ThemedText variant="amount">{formatMoney(row.amountMinor, row.currencyCode)}</ThemedText>
                  <StatusPill state={row.state} />
                </View>
              </View>
            ))}
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
    minHeight: 64,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 10
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
