export const GroupModes = ['flat', 'trip', 'couple', 'event', 'business', 'custom'] as const;
export type GroupMode = (typeof GroupModes)[number];

export const MembershipRoles = ['owner', 'admin', 'member', 'viewer'] as const;
export type MembershipRole = (typeof MembershipRoles)[number];

export const SettlementStates = [
  'suggested',
  'intent_created',
  'intent_generated',
  'payer_opened_upi_app',
  'awaiting_payment_evidence',
  'proof_submitted',
  'auto_matched',
  'awaiting_receiver_confirmation',
  'confirmed',
  'ledger_posted',
  'expired',
  'cancelled',
  'disputed',
  'rejected',
  'partial_detected',
  'duplicate_reference_review',
  'reversed',
  'refunded'
] as const;
export type SettlementState = (typeof SettlementStates)[number];

export const SplitTypes = ['equal', 'exact', 'percent', 'weight', 'itemized'] as const;
export type SplitType = (typeof SplitTypes)[number];
