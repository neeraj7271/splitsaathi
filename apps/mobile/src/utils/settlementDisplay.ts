import { SettlementIntent, SettlementState } from "../types/domain";
import { GroupDisplayLookups, resolveParticipantDisplayName } from "./displayNames";
import { formatMoney } from "./money";

export function settlementPrimaryUtr(row: SettlementIntent): string | undefined {
  const fromProof = row.proofs?.find((proof) => proof.utr?.trim())?.utr?.trim();
  if (fromProof) {
    return fromProof;
  }
  const reference = row.clientReference?.trim();
  return reference || undefined;
}

export function settlementHasViewableProof(row: SettlementIntent): boolean {
  return Boolean(
    row.proofAttachmentId ||
      row.proofUrl ||
      row.proofs?.some((proof) => proof.attachmentId)
  );
}

export function settlementProofPath(row: SettlementIntent): string | undefined {
  const attachmentId = row.proofAttachmentId ?? row.proofs?.find((proof) => proof.attachmentId)?.attachmentId;
  return row.proofUrl ?? (attachmentId ? `/v1/attachments/${attachmentId}/content` : undefined);
}

export function formatSettlementTimestamp(iso?: string): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

export function formatSettlementHistoryMeta(row: SettlementIntent): string {
  const parts = [
    formatSettlementTimestamp(row.createdAt),
    row.paymentMethod ? row.paymentMethod.toUpperCase() : undefined
  ];
  const utr = settlementPrimaryUtr(row);
  if (utr) {
    parts.push(utr.length > 14 ? `Ref ${utr.slice(0, 10)}…` : `Ref ${utr}`);
  }
  return parts.filter(Boolean).join(" • ");
}

export function formatSettlementDirection(
  settlement: Pick<SettlementIntent, "payerParticipantId" | "payeeParticipantId">,
  lookups?: GroupDisplayLookups
): string {
  const payer = lookups
    ? resolveParticipantDisplayName(settlement.payerParticipantId, lookups) ?? "Payer"
    : "Payer";
  const payee = lookups
    ? resolveParticipantDisplayName(settlement.payeeParticipantId, lookups) ?? "Payee"
    : "Payee";
  return `${payer} → ${payee}`;
}

export function formatSettlementPaymentMethod(method?: SettlementIntent["paymentMethod"]): string | undefined {
  if (method === "cash") {
    return "Cash";
  }
  if (method === "upi") {
    return "UPI";
  }
  return method ? String(method).toUpperCase() : undefined;
}

export function settlementStatusMessage(state: SettlementState): string {
  switch (state) {
    case "ledger_posted":
    case "confirmed":
      return "Settlement completed";
    case "awaiting_receiver_confirmation":
      return "Waiting for receiver confirmation";
    case "proof_submitted":
    case "auto_matched":
      return "Proof submitted";
    case "awaiting_payment_evidence":
      return "Waiting for payment proof";
    case "payer_opened_upi_app":
      return "UPI app opened";
    case "intent_generated":
      return "UPI payment ready";
    case "intent_created":
      return "Settlement started";
    case "rejected":
      return "Payment rejected";
    case "disputed":
      return "Payment disputed";
    case "expired":
      return "Settlement expired";
    case "cancelled":
      return "Settlement cancelled";
    case "reversed":
      return "Settlement reversed";
    case "refunded":
      return "Settlement refunded";
    default:
      return "Settlement update";
  }
}

export type SettlementDetailRowKind =
  | "from"
  | "to"
  | "method"
  | "created"
  | "updated"
  | "reference"
  | "payeeUpi"
  | "disputeReason"
  | "rejectionReason";

export type SettlementDetailRow = {
  kind: SettlementDetailRowKind;
  label: string;
  value: string;
  copyable?: boolean;
};

export type SettlementProofRow = {
  id: string;
  label: string;
  submittedAt?: string;
  attachmentId?: string;
};

export type SettlementDetailViewModel = {
  title: string;
  subtitle: string;
  amountLabel: string;
  state: SettlementState;
  statusMessage: string;
  detailRows: SettlementDetailRow[];
  proofRows: SettlementProofRow[];
  hasViewableProof: boolean;
  proofPath?: string;
};

export function buildSettlementDetailViewModel(
  settlement: SettlementIntent,
  lookups?: GroupDisplayLookups,
  overrides?: { title?: string; subtitle?: string }
): SettlementDetailViewModel {
  const subtitle = overrides?.subtitle ?? formatSettlementDirection(settlement, lookups);
  const detailRows: SettlementDetailRow[] = [
    {
      kind: "from",
      label: "From",
      value: lookups
        ? resolveParticipantDisplayName(settlement.payerParticipantId, lookups) ?? "Unknown payer"
        : "Payer"
    },
    {
      kind: "to",
      label: "To",
      value: lookups
        ? resolveParticipantDisplayName(settlement.payeeParticipantId, lookups) ?? "Unknown payee"
        : "Payee"
    },
    { kind: "method", label: "Method", value: formatSettlementPaymentMethod(settlement.paymentMethod) ?? "" },
    { kind: "created", label: "Created", value: formatSettlementTimestamp(settlement.createdAt) },
    {
      kind: "updated",
      label: "Updated",
      value:
        settlement.updatedAt && settlement.updatedAt !== settlement.createdAt
          ? formatSettlementTimestamp(settlement.updatedAt)
          : ""
    },
    {
      kind: "reference",
      label: "Reference",
      value: settlementPrimaryUtr(settlement) ?? "",
      copyable: Boolean(settlementPrimaryUtr(settlement))
    },
    {
      kind: "payeeUpi",
      label: "Payee UPI",
      value: settlement.payeeVpa ?? "",
      copyable: Boolean(settlement.payeeVpa?.trim())
    }
  ];

  if (settlement.state === "rejected" || settlement.state === "disputed") {
    detailRows.push({
      kind: settlement.state === "disputed" ? "disputeReason" : "rejectionReason",
      label: settlement.state === "disputed" ? "Dispute reason" : "Rejection reason",
      value: settlement.rejectionReason ?? ""
    });
  }

  const proofRows =
    settlement.proofs?.map((proof, index) => ({
      id: proof.id ?? `${proof.attachmentId ?? "proof"}-${index}`,
      label: proof.utr?.trim() ? `UTR ${proof.utr}` : `Proof ${index + 1}`,
      submittedAt: proof.submittedAt ? formatSettlementTimestamp(proof.submittedAt) : "Submitted",
      attachmentId: proof.attachmentId
    })) ?? [];

  return {
    title: overrides?.title ?? "Settlement details",
    subtitle,
    amountLabel: formatMoney(settlement.amountMinor, settlement.currencyCode),
    state: settlement.state,
    statusMessage: settlementStatusMessage(settlement.state),
    detailRows: detailRows.filter((row) => row.value.trim()),
    proofRows,
    hasViewableProof: settlementHasViewableProof(settlement),
    proofPath: settlementProofPath(settlement)
  };
}
