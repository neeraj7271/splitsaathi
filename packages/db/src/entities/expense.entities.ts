import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import type {
  BillAdjustmentAllocationBasis,
  BillAdjustmentType,
  EvidenceEntityType,
  ExpensePayerSource,
  ExpenseState,
  JsonObject,
  RoundingResidualSourceType,
  ShareType
} from './types';

@Entity({ name: 'expense_projection' })
@Index('idx_expense_projection_group_expense_date', ['groupId', 'expenseDate'])
@Index('idx_expense_projection_group_state_updated', ['groupId', 'state', 'updatedAt'])
export class ExpenseProjectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'current_version', type: 'integer' })
  currentVersion!: number;

  @Column({ type: 'text' })
  state!: ExpenseState;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'text', nullable: true })
  category!: string | null;

  @Column({ name: 'expense_date', type: 'date' })
  expenseDate!: string;

  @Column({ name: 'total_amount_minor', type: 'bigint' })
  totalAmountMinor!: string;

  @Column({ name: 'currency_code', type: 'char', length: 3 })
  currencyCode!: string;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId!: string;

  @Column({ name: 'last_event_id', type: 'uuid' })
  lastEventId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'voided_at', type: 'timestamptz', nullable: true })
  voidedAt!: Date | null;
}

@Entity({ name: 'expense_payers' })
@Index('uq_expense_payers_expense_participant_currency', ['expenseId', 'participantId', 'currencyCode'], {
  unique: true
})
export class ExpensePayerEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'expense_id', type: 'uuid' })
  expenseId!: string;

  @Column({ name: 'participant_id', type: 'uuid' })
  participantId!: string;

  @Column({ name: 'amount_minor', type: 'bigint' })
  amountMinor!: string;

  @Column({ name: 'currency_code', type: 'char', length: 3 })
  currencyCode!: string;

  @Column({ type: 'text' })
  source!: ExpensePayerSource;
}

@Entity({ name: 'expense_shares' })
@Index('uq_expense_shares_expense_participant_currency', ['expenseId', 'participantId', 'currencyCode'], {
  unique: true
})
export class ExpenseShareEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'expense_id', type: 'uuid' })
  expenseId!: string;

  @Column({ name: 'participant_id', type: 'uuid' })
  participantId!: string;

  @Column({ name: 'share_type', type: 'text' })
  shareType!: ShareType;

  @Column({ name: 'weight_numerator', type: 'bigint', nullable: true })
  weightNumerator!: string | null;

  @Column({ name: 'weight_denominator', type: 'bigint', nullable: true })
  weightDenominator!: string | null;

  @Column({ name: 'amount_minor', type: 'bigint' })
  amountMinor!: string;

  @Column({ name: 'currency_code', type: 'char', length: 3 })
  currencyCode!: string;

  @Column({ name: 'rounding_delta_minor', type: 'bigint', default: '0' })
  roundingDeltaMinor!: string;
}

@Entity({ name: 'expense_line_items' })
@Index('idx_expense_line_items_expense_position', ['expenseId', 'position'])
export class ExpenseLineItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'expense_id', type: 'uuid' })
  expenseId!: string;

  @Column({ name: 'receipt_draft_id', type: 'uuid', nullable: true })
  receiptDraftId!: string | null;

  @Column({ type: 'text' })
  label!: string;

  @Column({ type: 'numeric', precision: 12, scale: 4, default: '1' })
  quantity!: string;

  @Column({ name: 'unit_amount_minor', type: 'bigint' })
  unitAmountMinor!: string;

  @Column({ name: 'gross_amount_minor', type: 'bigint' })
  grossAmountMinor!: string;

  @Column({ name: 'currency_code', type: 'char', length: 3 })
  currencyCode!: string;

  @Column({ type: 'boolean', default: true })
  taxable!: boolean;

  @Column({ type: 'numeric', precision: 5, scale: 4, nullable: true })
  confidence!: string | null;

  @Column({ type: 'integer' })
  position!: number;
}

@Entity({ name: 'expense_line_item_assignments' })
@Index('idx_expense_line_item_assignments_line_item', ['lineItemId'])
@Index('idx_expense_line_item_assignments_participant', ['participantId'])
export class ExpenseLineItemAssignmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'line_item_id', type: 'uuid' })
  lineItemId!: string;

  @Column({ name: 'participant_id', type: 'uuid' })
  participantId!: string;

  @Column({ name: 'weight_numerator', type: 'bigint' })
  weightNumerator!: string;

  @Column({ name: 'weight_denominator', type: 'bigint' })
  weightDenominator!: string;

  @Column({ name: 'amount_minor', type: 'bigint' })
  amountMinor!: string;

  @Column({ name: 'rounding_delta_minor', type: 'bigint', default: '0' })
  roundingDeltaMinor!: string;
}

@Entity({ name: 'bill_adjustments' })
@Index('idx_bill_adjustments_expense_id', ['expenseId'])
export class BillAdjustmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'expense_id', type: 'uuid' })
  expenseId!: string;

  @Column({ name: 'adjustment_type', type: 'text' })
  adjustmentType!: BillAdjustmentType;

  @Column({ type: 'text' })
  label!: string;

  @Column({ name: 'amount_minor', type: 'bigint' })
  amountMinor!: string;

  @Column({ name: 'allocation_basis', type: 'text' })
  allocationBasis!: BillAdjustmentAllocationBasis;

  @Column({ name: 'currency_code', type: 'char', length: 3 })
  currencyCode!: string;
}

@Entity({ name: 'rounding_residual_allocations' })
@Index('idx_rounding_residual_allocations_source', ['sourceType', 'sourceId'])
export class RoundingResidualAllocationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'source_type', type: 'text' })
  sourceType!: RoundingResidualSourceType;

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId!: string;

  @Column({ name: 'participant_id', type: 'uuid' })
  participantId!: string;

  @Column({ name: 'currency_code', type: 'char', length: 3 })
  currencyCode!: string;

  @Column({ name: 'residual_minor', type: 'bigint' })
  residualMinor!: string;

  @Column({ type: 'text' })
  reason!: string;
}

@Entity({ name: 'expense_version_projection' })
@Index('uq_expense_version_projection_expense_version', ['expenseId', 'version'], { unique: true })
export class ExpenseVersionProjectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'expense_id', type: 'uuid' })
  expenseId!: string;

  @Column({ type: 'integer' })
  version!: number;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ name: 'actor_user_id', type: 'uuid' })
  actorUserId!: string;

  @Column({ name: 'change_summary', type: 'jsonb' })
  changeSummary!: JsonObject;

  @Column({ type: 'jsonb' })
  snapshot!: JsonObject;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'expense_comments' })
@Index('idx_expense_comments_expense_created', ['expenseId', 'createdAt'])
export class ExpenseCommentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'expense_id', type: 'uuid' })
  expenseId!: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ name: 'author_user_id', type: 'uuid' })
  authorUserId!: string;

  @Column({ type: 'text' })
  body!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'evidence_attachments' })
@Index('idx_evidence_attachments_entity', ['entityType', 'entityId'])
export class EvidenceAttachmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'entity_type', type: 'text' })
  entityType!: EvidenceEntityType;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId!: string;

  @Column({ name: 'attachment_id', type: 'uuid' })
  attachmentId!: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ name: 'uploaded_by_user_id', type: 'uuid' })
  uploadedByUserId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
