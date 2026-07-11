import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import type {
  JsonObject,
  PreferredUpiApp,
  ProofStatus,
  ProofType,
  SettlementConfirmationDecision,
  SettlementEventType,
  SettlementState,
  UpiReferenceSource
} from './types';

@Entity({ name: 'settlement_intents' })
@Index('idx_settlement_intents_group_state_created', ['groupId', 'state', 'createdAt'])
@Index('uq_settlement_intents_client_reference', ['clientReference'], { unique: true })
@Index('idx_settlement_intents_provider_payment', ['providerName', 'providerPaymentId'])
export class SettlementIntentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'payer_participant_id', type: 'uuid' })
  payerParticipantId!: string;

  @Column({ name: 'payee_participant_id', type: 'uuid' })
  payeeParticipantId!: string;

  @Column({ name: 'amount_minor', type: 'bigint' })
  amountMinor!: string;

  @Column({ name: 'currency_code', type: 'char', length: 3 })
  currencyCode!: string;

  @Column({ type: 'text' })
  state!: SettlementState;

  @Column({ name: 'suggestion_id', type: 'uuid', nullable: true })
  suggestionId!: string | null;

  @Column({ name: 'upi_uri', type: 'text', nullable: true })
  upiUri!: string | null;

  @Column({ name: 'upi_payee_vpa_encrypted', type: 'text', nullable: true })
  upiPayeeVpaEncrypted!: string | null;

  @Column({ name: 'upi_payee_name', type: 'text', nullable: true })
  upiPayeeName!: string | null;

  @Column({ name: 'preferred_upi_app', type: 'text', nullable: true })
  preferredUpiApp!: PreferredUpiApp | null;

  @Column({ name: 'client_reference', type: 'text' })
  clientReference!: string;

  @Column({ name: 'provider_name', type: 'text', nullable: true })
  providerName!: string | null;

  @Column({ name: 'provider_payment_id', type: 'text', nullable: true })
  providerPaymentId!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'settlement_events' })
@Index('idx_settlement_events_intent_occurred', ['settlementIntentId', 'occurredAt'])
export class SettlementEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'settlement_intent_id', type: 'uuid' })
  settlementIntentId!: string;

  @Column({ name: 'event_id', type: 'uuid', nullable: true })
  eventId!: string | null;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @Column({ name: 'event_type', type: 'text' })
  eventType!: SettlementEventType;

  @Column({ name: 'from_state', type: 'text', nullable: true })
  fromState!: SettlementState | null;

  @Column({ name: 'to_state', type: 'text' })
  toState!: SettlementState;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: JsonObject;

  @Column({ name: 'occurred_at', type: 'timestamptz', default: () => 'now()' })
  occurredAt!: Date;
}

@Entity({ name: 'upi_app_open_events' })
@Index('idx_upi_app_open_events_intent_opened', ['settlementIntentId', 'openedAt'])
export class UpiAppOpenEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'settlement_intent_id', type: 'uuid' })
  settlementIntentId!: string;

  @Column({ name: 'app_name', type: 'text' })
  appName!: string;

  @Column({ type: 'text' })
  platform!: string;

  @Column({ name: 'opened_at', type: 'timestamptz' })
  openedAt!: Date;

  @Column({ name: 'client_metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  clientMetadata!: JsonObject;
}

@Entity({ name: 'upi_payment_references' })
@Index('uq_upi_payment_references_group_reference_hash', ['groupId', 'upiReferenceHash'], { unique: true })
@Index('idx_upi_payment_references_intent', ['settlementIntentId'])
export class UpiPaymentReferenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'settlement_intent_id', type: 'uuid' })
  settlementIntentId!: string;

  @Column({ name: 'upi_reference_hash', type: 'text' })
  upiReferenceHash!: string;

  @Column({ type: 'text' })
  source!: UpiReferenceSource;

  @Column({ name: 'first_seen_proof_id', type: 'uuid', nullable: true })
  firstSeenProofId!: string | null;

  @Column({ name: 'provider_payment_id', type: 'text', nullable: true })
  providerPaymentId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'payment_proofs' })
@Index('idx_payment_proofs_intent_created', ['settlementIntentId', 'createdAt'])
@Index('idx_payment_proofs_group_reference_hash', ['groupId', 'upiReferenceHash'])
export class PaymentProofEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'settlement_intent_id', type: 'uuid' })
  settlementIntentId!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'submitted_by_user_id', type: 'uuid' })
  submittedByUserId!: string;

  @Column({ name: 'proof_type', type: 'text' })
  proofType!: ProofType;

  @Column({ name: 'attachment_id', type: 'uuid', nullable: true })
  attachmentId!: string | null;

  @Column({ name: 'upi_reference_hash', type: 'text', nullable: true })
  upiReferenceHash!: string | null;

  @Column({ name: 'claimed_amount_minor', type: 'bigint' })
  claimedAmountMinor!: string;

  @Column({ name: 'currency_code', type: 'char', length: 3 })
  currencyCode!: string;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt!: Date | null;

  @Column({ type: 'text' })
  status!: ProofStatus;

  @Column({ name: 'ocr_extracted', type: 'jsonb', nullable: true })
  ocrExtracted!: JsonObject | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'settlement_confirmations' })
@Index('idx_settlement_confirmations_intent_created', ['settlementIntentId', 'createdAt'])
export class SettlementConfirmationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'settlement_intent_id', type: 'uuid' })
  settlementIntentId!: string;

  @Column({ name: 'confirmed_by_user_id', type: 'uuid' })
  confirmedByUserId!: string;

  @Column({ type: 'text' })
  decision!: SettlementConfirmationDecision;

  @Column({ name: 'amount_minor', type: 'bigint', nullable: true })
  amountMinor!: string | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
