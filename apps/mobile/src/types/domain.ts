export type GroupMode = "flat" | "trip" | "couple" | "event" | "business" | "custom";
export type GroupType = "trip" | "couple" | "home" | "event" | "business" | "other";
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
  linkedUserId?: string;
  /** Default UPI ID for receiving payments (from linked user profile). */
  upiVpa?: string | null;
  participantType?: "individual" | "guest" | "couple" | "household" | "subgroup";
  state?: "active" | "claimed" | "inactive";
}

export interface Membership {
  id: string;
  participantId: string;
  userId?: string;
  role: MembershipRole;
  status: "active" | "locked_for_exit" | "inactive" | "inactive_locked" | "removed_zero_balance" | "transferred_obligation";
  balanceMinor?: number;
}

export interface GroupSummary {
  id: string;
  name: string;
  mode: GroupMode;
  baseCurrencyCode: string;
  state: "active" | "archived" | "deleted_empty";
  category?: string | null;
  groupType: GroupType;
  imageAttachmentId?: string | null;
  imageUrl?: string | null;
  netBalanceMinor?: number;
  pendingProofCount?: number;
  participantCount?: number;
  currentUserRole?: MembershipRole;
  updatedAt?: string;
}

export interface GroupDetail extends GroupSummary {
  participants: Participant[];
  memberships: Membership[];
  inviteUrl?: string;
  /** Whether the current user can edit or void expenses. */
  canManageExpenses?: boolean;
  /** Group setting: members may edit/void expenses (admins can turn this off). */
  membersCanEditExpenses?: boolean;
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
  notes?: string;
  expenseDate: string;
  totalAmountMinor: number;
  currencyCode: string;
  state: "active" | "voided";
  currentVersion: number;
  updatedAt?: string;
}

export interface ExpenseDetail extends ExpenseRow {
  payers: Array<{ participantId: string; amountMinor: number }>;
  shares: Array<{
    participantId: string;
    amountMinor: number;
    shareType: string;
    roundingDeltaMinor?: number;
  }>;
  lineItems: Array<{ label: string; amountMinor: number; participantIds: string[] }>;
  billAdjustments: Array<{
    adjustmentType: string;
    label: string;
    amountMinor: number;
    allocationBasis?: string;
  }>;
  voidReason?: string;
}

export interface ReportEnvelope<T> {
  from: string;
  to: string;
  items: T[];
}

export interface MonthlyComparisonReport {
  month: string;
  amountMinor: string;
  expenseCount: number;
}

export interface MemberContributionReport {
  participantId: string;
  displayName: string;
  amountMinor: string;
}

export interface SettlementMethodReport {
  method: "cash" | "upi";
  amountMinor: string;
  count: number;
}

export interface NetPositionReport {
  participantId: string;
  displayName: string;
  currencyCode: string;
  amountMinor: string;
}

export interface ActivityRowDto {
  id: string;
  groupId: string;
  activityType: string;
  title: string;
  body?: string;
  actorId?: string;
  amountMinor?: number;
  currencyCode?: string;
  entityType?: string;
  entityId?: string;
  status?: SettlementState | "pending" | "confirmed" | "disputed";
  context?: Record<string, unknown>;
  occurredAt: string;
  globalPosition?: number;
}

export interface ExpenseExplanation {
  expenseId: string;
  groupId: string;
  description: string;
  notes?: string;
  status: "active" | "voided";
  totalAmountMinor: number;
  currencyCode: string;
  formattedTotal: string;
  splitMethod: SplitType | "mixed";
  paidBy: Array<{ participantId: string; amountMinor: number; formattedAmount: string }>;
  owedBy: Array<{ participantId: string; amountMinor: number; formattedAmount: string; shareType: SplitType; roundingDeltaMinor: number }>;
  itemizedDetail?: {
    lineItems: Array<{ label: string; amountMinor: number; participantIds: string[]; formattedAmount: string }>;
    billAdjustments: Array<{ adjustmentType: string; label: string; amountMinor: number; allocationBasis: string; formattedAmount: string }>;
  };
  explanation: string;
  snapshotVersion: number;
}

export interface AuditEntry {
  id: string;
  version?: number;
  actorId?: string;
  actorName?: string;
  summary: string;
  reason?: string;
  changes?: Array<{ field: string; detail: string }>;
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
  paymentMethod?: "cash" | "upi";
  state: SettlementState;
  upiUri?: string;
  qrPayload?: string;
  payeeVpa?: string;
  clientReference?: string;
  expiresAt?: string;
  createdAt?: string;
  proofs?: Array<{ id?: string; attachmentId?: string; utr?: string; submittedAt?: string }>;
  proofAttachmentId?: string;
  proofUrl?: string;
  /** Rejection / dispute reason from the settlement timeline. */
  rejectionReason?: string;
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
  maskedDestination?: string;
  deliveryMode?: string;
  expiresAt?: string;
  devCode?: string;
}

export interface StartEmailOtpResponse {
  challengeId: string;
  deliveryMode: string;
  expiresAt: string;
  resendAvailableAt: string;
  devCode?: string;
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
  needsOnboarding?: boolean;
  needsPhoneLink?: boolean;
  suggestedPhoneE164?: string | null;
}

export interface UserProfile {
  id: string;
  displayName: string;
  defaultCurrencyCode: string;
  state: string;
  phoneMasked?: string;
  email?: string | null;
  avatarAttachmentId?: string | null;
  avatarUrl?: string | null;
  upiVpa?: string | null;
}

export type UserAppearancePreference = "system" | "light" | "dark";

export interface UserPreferences {
  biometricAuthEnabled: boolean;
  sessionTimeoutSeconds: number;
  appearance: UserAppearancePreference;
  pushNotificationsEnabled: boolean;
  emailGroupAdded: boolean;
  emailFriendAdded: boolean;
  emailExpenseAdded: boolean;
  emailExpenseEdited: boolean;
  emailExpenseComment: boolean;
  emailExpenseDue: boolean;
  emailPaymentReceived: boolean;
  emailMonthlySummary: boolean;
  emailNewsUpdates: boolean;
}

export type FriendBalanceStatus = "owes_you" | "you_owe" | "settled" | "no_expenses";

export interface FriendSharedGroup {
  groupId: string;
  groupName: string;
  pairNetMinor: number;
  currencyCode: string;
}

export interface FriendSummary {
  otherUserId: string;
  displayName: string;
  avatarUrl?: string | null;
  currencyCode: string;
  netMinor: number;
  status: FriendBalanceStatus;
  sharedGroupCount: number;
  sharedGroups: FriendSharedGroup[];
}

export interface FriendTransaction {
  id: string;
  kind: "expense" | "settlement";
  groupId: string;
  groupName: string;
  occurredAt: string;
  description: string;
  amountMinor: number;
  currencyCode: string;
  expenseId?: string;
  settlementIntentId?: string;
}

export interface FriendDetail {
  friend: FriendSummary;
  transactions: FriendTransaction[];
}
