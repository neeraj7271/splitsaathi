import type { SettlementState } from '@splitsaathi/contracts';

export type SettlementPaymentMethod = 'cash' | 'upi';

export interface SettlementIntentRow {
  settlementIntentId: string;
  groupId: string;
  payerParticipantId: string;
  payeeParticipantId: string;
  amountMinor: number;
  currencyCode: string;
  note: string;
  paymentMethod: SettlementPaymentMethod;
  state: SettlementState;
  providerReference?: string;
  upiUri?: string;
  qrPayload?: string;
  payeeVpa?: string;
  expiresAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  ledgerPostedAt?: string;
  proofs: PaymentProofRow[];
  appOpenEvents: UpiAppOpenRow[];
  timeline: SettlementTimelineRow[];
}

export interface PaymentProofRow {
  proofId: string;
  settlementIntentId: string;
  submittedBy: string;
  amountMinor?: number;
  utr?: string;
  note?: string;
  attachmentId?: string;
  submittedAt: string;
}

export interface UpiAppOpenRow {
  settlementIntentId: string;
  openedBy: string;
  upiApp?: string;
  openedAt: string;
}

export interface SettlementTimelineRow {
  eventId: string;
  type: string;
  state: SettlementState;
  actorId?: string;
  occurredAt: string;
  note?: string;
}

export interface CreateSettlementIntentCommand {
  idempotencyKey: string;
  actorId: string;
  groupId: string;
  settlementIntentId?: string;
  payerParticipantId: string;
  payeeParticipantId: string;
  amountMinor: number;
  currencyCode?: string;
  paymentMethod?: SettlementPaymentMethod;
  payeeVpa?: string;
  payeeName: string;
  note?: string;
}

export interface MarkUpiOpenedCommand {
  idempotencyKey: string;
  actorId: string;
  settlementIntentId: string;
  upiApp?: string;
  expectedVersion: number;
}

export interface RegenerateUpiIntentCommand {
  idempotencyKey: string;
  actorId: string;
  settlementIntentId: string;
  payeeVpa: string;
  payeeName?: string;
  expectedVersion: number;
}

export interface SubmitPaymentProofCommand {
  idempotencyKey: string;
  actorId: string;
  settlementIntentId: string;
  amountMinor?: number;
  utr?: string;
  note?: string;
  attachmentId?: string;
  expectedVersion: number;
}

export interface SettlementTransitionCommand {
  idempotencyKey: string;
  actorId: string;
  settlementIntentId: string;
  expectedVersion: number;
  reason?: string;
}
