export type GroupMode = "flat" | "trip" | "couple" | "event" | "business" | "custom";
export type MembershipRole = "owner" | "admin" | "member" | "viewer";
export type SplitType = "equal" | "exact" | "percent" | "weight" | "itemized";
export type SettlementState =
  | "suggested"
  | "intent_created"
  | "intent_generated"
  | "payer_opened_upi_app"
  | "awaiting_payment_evidence"
  | "proof_submitted"
  | "auto_matched"
  | "awaiting_receiver_confirmation"
  | "confirmed"
  | "ledger_posted"
  | "expired"
  | "cancelled"
  | "disputed"
  | "rejected"
  | "partial_detected"
  | "duplicate_reference_review"
  | "reversed"
  | "refunded";

export interface MoneyDto {
  amountMinor: number;
  currencyCode: string;
}

export interface Participant {
  id: string;
  displayName: string;
  phoneE164?: string;
  phoneHash?: string;
  participantType?: "individual" | "guest" | "couple" | "household" | "subgroup";
  state?: "active" | "claimed" | "inactive";
}

export interface Membership {
  id: string;
  participantId: string;
  role: MembershipRole;
  status: "active" | "inactive_locked" | "removed_zero_balance" | "transferred_obligation";
  balanceMinor?: number;
}

export interface GroupSummary {
  id: string;
  name: string;
  mode: GroupMode;
  baseCurrencyCode: string;
  state: "active" | "archived" | "deleted_empty";
  netBalanceMinor?: number;
  pendingProofCount?: number;
  participantCount?: number;
  updatedAt?: string;
}

export interface GroupDetail extends GroupSummary {
  participants: Participant[];
  memberships: Membership[];
  inviteUrl?: string;
}

export interface BalanceRow {
  participantId: string;
  displayName: string;
  currencyCode: string;
  balanceMinor: number;
  explanation?: string;
}

export interface ExpenseRow {
  id: string;
  groupId: string;
  description: string;
  category?: string;
  expenseDate: string;
  totalAmountMinor: number;
  currencyCode: string;
  state: "active" | "voided";
  currentVersion: number;
  updatedAt?: string;
}

export interface ActivityRowDto {
  id: string;
  groupId: string;
  activityType: string;
  title: string;
  body?: string;
  amountMinor?: number;
  currencyCode?: string;
  entityType?: string;
  entityId?: string;
  status?: SettlementState | "pending" | "confirmed" | "disputed";
  occurredAt: string;
}

export interface AuditEntry {
  id: string;
  version?: number;
  actorName?: string;
  summary: string;
  reason?: string;
  createdAt: string;
}

export interface SettlementSuggestion {
  id: string;
  groupId: string;
  payerParticipantId: string;
  payerName: string;
  payeeParticipantId: string;
  payeeName: string;
  amountMinor: number;
  currencyCode: string;
  explanation: string;
}

export interface SettlementIntent {
  id: string;
  groupId: string;
  payerParticipantId: string;
  payeeParticipantId: string;
  amountMinor: number;
  currencyCode: string;
  state: SettlementState;
  upiUri?: string;
  qrPayload?: string;
  clientReference?: string;
  expiresAt?: string;
  createdAt?: string;
}

export interface RecurringSchedule {
  id: string;
  groupId: string;
  title: string;
  amountMinor: number;
  currencyCode: string;
  frequency: "weekly" | "monthly" | "custom_rrule";
  state: "active" | "paused" | "ended";
  nextRunAt?: string;
  reminderDaysBefore?: number;
}

export interface ImportJob {
  id: string;
  source?: "splitwise_csv" | "splitwise_json";
  state: "uploaded" | "parsed" | "reviewed" | "posting" | "completed" | "committed" | "failed";
  summary?: Record<string, unknown>;
}

export interface ExportJob {
  id: string;
  exportType: "expenses_csv" | "balances_csv" | "full_group_csv" | "group_pdf" | "tally_csv" | "settlement_certificate" | "data_portability_json";
  state: string;
  fileUrl?: string;
  data?: string;
  contentType?: string;
}

export interface StartOtpResponse {
  challengeId: string;
  expiresAt?: string;
}

export interface VerifyOtpResponse {
  user: {
    id: string;
    displayName: string;
    defaultCurrencyCode?: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresInSeconds: number;
  };
}
