/** Event types shown on Home + Group activity (ledger facts only). */
export const LEDGER_ACTIVITY_TYPES = new Set([
  "ExpenseCreated",
  "ExpenseAdjusted",
  "ExpenseVoided",
  "CashSettlementRecorded",
  "SettlementConfirmed",
  "SettlementLedgerPosted",
  "SettlementReversed",
  "SettlementRefunded"
]);

/** Intermediate settlement pipeline events — Settle screen only. */
export const SETTLEMENT_PIPELINE_ACTIVITY_TYPES = new Set([
  "SettlementIntentCreated",
  "UpiIntentGenerated",
  "UpiAppOpened",
  "PaymentProofSubmitted",
  "PaymentAutoMatched",
  "ReceiverConfirmationRequested",
  "SettlementRejected",
  "SettlementDisputed",
  "SettlementExpired",
  "SettlementCancelled",
  "DuplicatePaymentReferenceDetected",
  "PartialPaymentDetected"
]);

export type ActivityFeedKind = "ledger" | "settlement" | "all";

export function isLedgerActivityEvent(eventType: string): boolean {
  return LEDGER_ACTIVITY_TYPES.has(eventType);
}

export function matchesActivityFeed(eventType: string, feed: ActivityFeedKind = "ledger"): boolean {
  if (feed === "all") {
    return true;
  }
  if (feed === "ledger") {
    return LEDGER_ACTIVITY_TYPES.has(eventType);
  }
  return SETTLEMENT_PIPELINE_ACTIVITY_TYPES.has(eventType) || LEDGER_ACTIVITY_TYPES.has(eventType);
}
