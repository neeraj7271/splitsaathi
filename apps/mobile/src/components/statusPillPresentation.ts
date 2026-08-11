import type { ThemeColors } from "../theme/colors";
import type { SettlementState } from "../types/domain";

export type StatusPillState =
  | "pending"
  | "proof_submitted"
  | "awaiting_receiver_confirmation"
  | "confirmed"
  | "ledger_posted"
  | "disputed"
  | "rejected"
  | "expired"
  | SettlementState;

export const statusPillLabels: Record<string, string> = {
  pending: "Pending",
  suggested: "Suggested",
  intent_created: "Intent",
  intent_generated: "UPI ready",
  payer_opened_upi_app: "UPI opened",
  awaiting_payment_evidence: "Need proof",
  proof_submitted: "Proof submitted",
  auto_matched: "Auto matched",
  awaiting_receiver_confirmation: "Awaiting confirmation",
  confirmed: "Confirmed",
  ledger_posted: "Posted",
  expired: "Expired",
  cancelled: "Cancelled",
  disputed: "Disputed",
  rejected: "Rejected",
  partial_detected: "Partial",
  duplicate_reference_review: "Duplicate review",
  reversed: "Reversed",
  refunded: "Refunded"
};

import { colorWithAlpha } from "../theme";

export function getStatusPillPresentation(state: StatusPillState, colors: ThemeColors) {
  let color: string = colors.pending;
  let bg: string = colorWithAlpha(colors.pending, 0.12);

  if (state === "confirmed" || state === "ledger_posted") {
    color = "#10B981";
    bg = "#DCFCE7";
  } else if (state === "awaiting_receiver_confirmation" || state === "proof_submitted") {
    color = "#6366F1";
    bg = "#EEF2FF";
  } else if (state === "payer_opened_upi_app" || state === "intent_generated" || state === "intent_created") {
    color = "#D97706";
    bg = "#FEF3C7";
  } else if (state === "expired" || state === "cancelled") {
    color = "#64748B";
    bg = "#F1F5F9";
  } else if (state === "disputed" || state === "rejected") {
    color = colors.disputed;
    bg = colorWithAlpha(colors.disputed, 0.12);
  }

  return {
    label: statusPillLabels[state] ?? String(state),
    color,
    bg
  };
}
