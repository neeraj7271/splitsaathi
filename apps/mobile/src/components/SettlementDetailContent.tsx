import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  CalendarBlank,
  CaretRight,
  ClockCounterClockwise,
  Copy,
  FileText,
  ImageSquare,
  Lightning,
  QrCode,
  ShieldCheck,
  User,
  WarningCircle
} from "phosphor-react-native";

import { useOptionalAppDialog } from "./AppDialog";
import { Button } from "./Button";
import { DataSurface } from "./DataSurface";
import { ImagePreviewModal } from "./ImagePreviewModal";
import { StatusPill } from "./StatusPill";
import { ThemedText } from "./ThemedText";
import { colorWithAlpha, useTheme } from "../theme";
import { SettlementIntent } from "../types/domain";
import { openAuthenticatedAttachment } from "../utils/authenticatedAttachment";
import { copyText } from "../utils/clipboard";
import { GroupDisplayLookups } from "../utils/displayNames";
import { buildSettlementDetailViewModel, SettlementDetailRow, SettlementDetailRowKind } from "../utils/settlementDisplay";
import { getStatusPillPresentation } from "./statusPillPresentation";

export type SettlementDetailAction = {
  label: string;
  variant?: "primary" | "secondary" | "destructive" | "ghost";
  onPress: (settlement: SettlementIntent) => void;
  closeOnPress?: boolean;
};

export type SettlementDetailContentProps = {
  settlement: SettlementIntent;
  lookups?: GroupDisplayLookups;
  title?: string;
  subtitle?: string;
  actions?: SettlementDetailAction[];
  onActionPress?: (action: SettlementDetailAction, settlement: SettlementIntent) => void;
};

function rowIcon(kind: SettlementDetailRowKind, color: string) {
  const props = { size: 18, color, weight: "duotone" as const };
  switch (kind) {
    case "from":
      return <User {...props} />;
    case "to":
      return <User {...props} />;
    case "method":
      return <Lightning {...props} />;
    case "created":
      return <CalendarBlank {...props} />;
    case "updated":
      return <ClockCounterClockwise {...props} />;
    case "reference":
      return <FileText {...props} />;
    case "payeeUpi":
      return <QrCode {...props} />;
    default:
      return <WarningCircle {...props} />;
  }
}

function rowIconTint(kind: SettlementDetailRowKind, colors: ReturnType<typeof useTheme>["colors"]) {
  switch (kind) {
    case "from":
      return { bg: colorWithAlpha(colors.info, 0.14), fg: colors.info };
    case "to":
      return { bg: colorWithAlpha(colors.confirmed, 0.14), fg: colors.confirmed };
    case "method":
      return { bg: colorWithAlpha("#8B5CF6", 0.14), fg: "#8B5CF6" };
    case "created":
      return { bg: colorWithAlpha("#3B82F6", 0.14), fg: "#3B82F6" };
    case "updated":
      return { bg: colorWithAlpha(colors.pending, 0.14), fg: colors.pending };
    case "reference":
      return { bg: colorWithAlpha(colors.info, 0.14), fg: colors.info };
    case "payeeUpi":
      return { bg: colorWithAlpha(colors.confirmed, 0.14), fg: colors.confirmed };
    default:
      return { bg: colorWithAlpha(colors.disputed, 0.14), fg: colors.disputed };
  }
}

function SettlementDetailInfoRow({
  row,
  onCopy,
  isLast = false
}: {
  row: SettlementDetailRow;
  onCopy: (value: string) => void;
  isLast?: boolean;
}) {
  const theme = useTheme();
  const tint = rowIconTint(row.kind, theme.colors);

  return (
    <View
      style={[
        styles.infoRow,
        !isLast ? { borderBottomColor: theme.colors.hairline, borderBottomWidth: StyleSheet.hairlineWidth } : null
      ]}
    >
      <View style={[styles.infoIcon, { backgroundColor: tint.bg }]}>
        {rowIcon(row.kind, tint.fg)}
      </View>
      <View style={styles.infoCopy}>
        <ThemedText variant="bodySm" tone="muted">
          {row.label}
        </ThemedText>
        <ThemedText variant="bodyMedium" style={styles.infoValue}>
          {row.value}
        </ThemedText>
      </View>
      {row.copyable ? (
        <Pressable
          onPress={() => onCopy(row.value)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Copy ${row.label}`}
          style={[styles.copyButton, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.surface }]}
        >
          <Copy size={16} color={theme.colors.inkMuted} weight="bold" />
        </Pressable>
      ) : null}
    </View>
  );
}

export function SettlementDetailContent({
  settlement,
  lookups,
  title,
  subtitle,
  actions = [],
  onActionPress
}: SettlementDetailContentProps) {
  const theme = useTheme();
  const dialog = useOptionalAppDialog();
  const [proofPreviewUri, setProofPreviewUri] = useState<string>();
  const [proofLoading, setProofLoading] = useState(false);
  const model = buildSettlementDetailViewModel(settlement, lookups, { title, subtitle });
  const status = getStatusPillPresentation(model.state, theme.colors);

  async function viewProof(path = model.proofPath) {
    if (!path) {
      return;
    }
    setProofLoading(true);
    try {
      const file = await openAuthenticatedAttachment(path);
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

  async function handleCopy(value: string) {
    const copied = await copyText(value);
    if (copied) {
      dialog?.showDialog({
        title: "Copied",
        message: "Value copied to clipboard.",
        tone: "success",
        primaryAction: { label: "OK" }
      });
    }
  }

  return (
    <View style={styles.root}>
      <DataSurface elevated padded>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryIcon, { backgroundColor: colorWithAlpha(status.color, 0.14) }]}>
            <ShieldCheck size={24} color={status.color} weight="duotone" />
          </View>
          <View style={styles.summaryCenter}>
            <StatusPill state={model.state} />
            <ThemedText variant="bodySm" tone="muted">
              {model.statusMessage}
            </ThemedText>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: theme.colors.hairline }]} />
          <View style={styles.summaryAmount}>
            <ThemedText variant="amount" style={{ color: status.color }}>
              {model.amountLabel}
            </ThemedText>
          </View>
        </View>
      </DataSurface>

      <DataSurface padded>
        {model.detailRows.map((row, index) => (
          <SettlementDetailInfoRow
            key={row.kind}
            row={row}
            onCopy={handleCopy}
            isLast={index === model.detailRows.length - 1}
          />
        ))}
      </DataSurface>

      {model.proofRows.length ? (
        <View style={styles.proofSection}>
          <ThemedText variant="section" style={styles.sectionTitle}>
            Payment proofs
          </ThemedText>
          <DataSurface padded>
            {model.proofRows.map((proof, index) => (
              <Pressable
                key={proof.id}
                onPress={() =>
                  void viewProof(
                    proof.attachmentId ? `/v1/attachments/${proof.attachmentId}/content` : model.proofPath
                  )
                }
                style={({ pressed }) => [
                  styles.proofRow,
                  index > 0
                    ? { borderTopColor: theme.colors.hairline, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4, paddingTop: 16 }
                    : null,
                  pressed ? { opacity: 0.75 } : null
                ]}
              >
                <View style={[styles.proofIcon, { backgroundColor: colorWithAlpha(theme.colors.confirmed, 0.14) }]}>
                  <ImageSquare size={18} color={theme.colors.confirmed} weight="duotone" />
                </View>
                <View style={styles.proofCopy}>
                  <ThemedText variant="bodyMedium">{proof.label}</ThemedText>
                  <ThemedText variant="bodySm" tone="muted">
                    {proof.submittedAt}
                  </ThemedText>
                </View>
                <CaretRight size={16} color={theme.colors.inkMuted} weight="bold" />
              </Pressable>
            ))}
          </DataSurface>
        </View>
      ) : null}

      {model.hasViewableProof ? (
        <Pressable
          onPress={() => void viewProof()}
          disabled={proofLoading}
          style={({ pressed }) => [
            styles.proofCta,
            {
              backgroundColor: theme.colors.confirmed,
              opacity: proofLoading || pressed ? 0.82 : 1
            }
          ]}
        >
          <ShieldCheck size={20} color="#FFFFFF" weight="duotone" />
          <ThemedText variant="button" style={styles.proofCtaLabel}>
            View payment proof
          </ThemedText>
          <CaretRight size={18} color="#FFFFFF" weight="bold" />
        </Pressable>
      ) : null}

      {actions.map((action) => (
        <Button
          key={action.label}
          label={action.label}
          variant={action.variant ?? "primary"}
          onPress={() => {
            action.onPress(settlement);
            onActionPress?.(action, settlement);
          }}
        />
      ))}

      <ImagePreviewModal
        visible={Boolean(proofPreviewUri)}
        uri={proofPreviewUri}
        title="Payment proof"
        onClose={() => setProofPreviewUri(undefined)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center"
  },
  summaryCenter: {
    flex: 1,
    gap: 6,
    minWidth: 0
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginVertical: 4
  },
  summaryAmount: {
    minWidth: 88,
    alignItems: "flex-end"
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  infoCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0
  },
  infoValue: {
    flexShrink: 1
  },
  copyButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  proofSection: {
    gap: 8
  },
  sectionTitle: {
    paddingHorizontal: 2
  },
  proofRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  proofIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  proofCopy: {
    flex: 1,
    gap: 3
  },
  proofCta: {
    minHeight: 54,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  proofCtaLabel: {
    flex: 1,
    color: "#FFFFFF"
  }
});
