export declare const GroupModes: readonly ["flat", "trip", "couple", "event", "business", "custom"];
export type GroupMode = (typeof GroupModes)[number];
export declare const MembershipRoles: readonly ["owner", "admin", "member", "viewer"];
export type MembershipRole = (typeof MembershipRoles)[number];
export declare const SettlementStates: readonly ["suggested", "intent_created", "intent_generated", "payer_opened_upi_app", "awaiting_payment_evidence", "proof_submitted", "auto_matched", "awaiting_receiver_confirmation", "confirmed", "ledger_posted", "expired", "cancelled", "disputed", "rejected", "partial_detected", "duplicate_reference_review", "reversed", "refunded"];
export type SettlementState = (typeof SettlementStates)[number];
export declare const SplitTypes: readonly ["equal", "exact", "percent", "weight", "itemized"];
export type SplitType = (typeof SplitTypes)[number];
