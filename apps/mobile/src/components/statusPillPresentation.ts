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

export function getStatusPillPresentation(state: StatusPillState, colors: ThemeColors) {
  const color =
    state === "confirmed" || state === "ledger_posted"
      ? colors.confirmed
      : state === "disputed" || state === "rejected"
        ? colors.disputed
        : state === "awaiting_receiver_confirmation"
          ? colors.info
          : state === "expired" || state === "cancelled"
            ? colors.inkMuted
            : colors.pending;

  return {
    label: statusPillLabels[state] ?? String(state),
    color
  };
}
