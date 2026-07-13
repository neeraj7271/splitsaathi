export type JsonObject = Record<string, unknown>;

export type UserStatus = 'active' | 'deactivated' | 'deleted_pending';
export type AuthProvider = 'phone_otp' | 'google' | 'apple';
export type OtpPurpose = 'login' | 'claim_invite';
export type DevicePlatform = 'ios' | 'android';
export type ConsentPurpose =
  | 'contacts_discovery'
  | 'receipt_upload'
  | 'upi_proof_storage'
  | 'notification_delivery'
  | 'financial_import';
export type ConsentStatus = 'granted' | 'revoked';
export type ConsentSource = 'onboarding' | 'settings' | 'capture_flow';
export type ContactAliasSource = 'manual' | 'contacts_import';

export type GroupMode = 'flat' | 'trip' | 'couple' | 'event' | 'business' | 'custom';
export type GroupState = 'active' | 'archived' | 'deleted_empty';
export type ParticipantType = 'individual' | 'guest' | 'couple' | 'household' | 'subgroup';
export type ParticipantState = 'active' | 'claimed' | 'inactive';
export type MembershipRole = 'owner' | 'admin' | 'member' | 'viewer';
export type MembershipStatus =
  | 'active'
  | 'inactive_locked'
  | 'removed_zero_balance'
  | 'transferred_obligation';
export type ParticipantRelationshipType =
  | 'couple_member'
  | 'household_member'
  | 'subgroup_member';
export type GroupPermission =
  | 'expense_create'
  | 'expense_edit_own'
  | 'expense_edit_any'
  | 'expense_void'
  | 'settlement_confirm'
  | 'member_invite'
  | 'member_role_change'
  | 'export'
  | 'archive';

export type IdempotencyStatus = 'processing' | 'succeeded' | 'failed';
export type PostingType =
  | 'expense_payment'
  | 'expense_share'
  | 'settlement_paid'
  | 'settlement_received'
  | 'fx_close'
  | 'fx_open'
  | 'obligation_transfer_debit'
  | 'obligation_transfer_credit'
  | 'reversal';

export type ExpenseState = 'active' | 'voided';
export type ExpensePayerSource = 'cash' | 'upi' | 'card' | 'unknown';
export type ShareType = 'equal' | 'exact' | 'percent' | 'weight' | 'itemized';
export type BillAdjustmentType =
  | 'tax'
  | 'gst_cgst'
  | 'gst_sgst'
  | 'service_charge'
  | 'tip'
  | 'discount'
  | 'rounding';
export type BillAdjustmentAllocationBasis =
  | 'subtotal_proportional'
  | 'equal'
  | 'manual'
  | 'taxable_items_only';
export type RoundingResidualSourceType = 'expense' | 'line_item' | 'bill_adjustment' | 'fx';
export type EvidenceEntityType = 'expense' | 'settlement' | 'dispute';

export type RecurringScheduleState = 'active' | 'paused' | 'ended';
export type RecurringFrequency = 'weekly' | 'monthly' | 'custom_rrule';
export type RecurringOccurrenceState = 'pending' | 'generated' | 'skipped' | 'failed';

export type SettlementState =
  | 'suggested'
  | 'intent_created'
  | 'intent_generated'
  | 'payer_opened_upi_app'
  | 'awaiting_payment_evidence'
  | 'proof_submitted'
  | 'auto_matched'
  | 'awaiting_receiver_confirmation'
  | 'confirmed'
  | 'ledger_posted'
  | 'expired'
  | 'cancelled'
  | 'disputed'
  | 'rejected'
  | 'partial_detected'
  | 'duplicate_reference_review'
  | 'reversed'
  | 'refunded';
export type PreferredUpiApp = 'gpay' | 'phonepe' | 'paytm' | 'bhim' | 'other';
export type SettlementEventType =
  | 'intent_created'
  | 'upi_uri_generated'
  | 'upi_app_opened'
  | 'proof_submitted'
  | 'proof_auto_matched'
  | 'receiver_confirmed'
  | 'receiver_rejected'
  | 'disputed'
  | 'ledger_posted'
  | 'expired'
  | 'reversed'
  | 'refunded';
export type UpiReferenceSource = 'proof_utr' | 'provider_callback' | 'manual_entry';
export type ProofType = 'screenshot' | 'utr_text' | 'provider_callback' | 'manual_note';
export type ProofStatus =
  | 'submitted'
  | 'auto_matched'
  | 'needs_receiver_confirmation'
  | 'accepted'
  | 'rejected'
  | 'disputed';
export type SettlementConfirmationDecision =
  | 'accept'
  | 'reject'
  | 'dispute'
  | 'accept_partial';

export type AttachmentPurpose = 'receipt' | 'payment_proof' | 'avatar' | 'group_image' | 'export';
export type ReceiptDraftSource = 'gallery' | 'camera' | 'screenshot' | 'share_sheet' | 'manual_text';
export type ReceiptDraftState =
  | 'uploaded'
  | 'ocr_pending'
  | 'needs_review'
  | 'reviewed'
  | 'posted'
  | 'discarded';
export type CaptureSource =
  | 'share_sheet'
  | 'paste'
  | 'sms_manual'
  | 'email_forward'
  | 'android_notification';

export type NotificationTone = 'neutral' | 'urgent' | 'system';
export type NotificationChannel = 'push' | 'email' | 'in_app';
export type NotificationDeliveryStatus = 'queued' | 'sent' | 'failed' | 'suppressed';
export type ReminderScheduleType = 'settlement_day' | 'recurring_expense' | 'stale_proof';

export type ImportSource = 'splitwise_csv' | 'splitwise_json';
export type ImportJobState = 'uploaded' | 'parsed' | 'reviewed' | 'posting' | 'completed' | 'failed';
export type ImportItemStatus = 'pending' | 'accepted' | 'skipped' | 'duplicate' | 'posted' | 'failed';
export type ExportType =
  | 'expenses_csv'
  | 'balances_csv'
  | 'full_group_csv'
  | 'group_pdf'
  | 'tally_csv'
  | 'settlement_certificate'
  | 'data_portability_json';

export type OfflineCommandStatus =
  | 'queued'
  | 'processing'
  | 'accepted'
  | 'rejected'
  | 'conflicted'
  | 'failed';
