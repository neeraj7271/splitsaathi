import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import type {
  AttachmentPurpose,
  CaptureSource,
  JsonObject,
  ReceiptDraftSource,
  ReceiptDraftState
} from './types';

@Entity({ name: 'attachments' })
@Index('idx_attachments_owner_created', ['ownerUserId', 'createdAt'])
@Index('idx_attachments_sha256', ['sha256'])
export class AttachmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'owner_user_id', type: 'uuid' })
  ownerUserId!: string;

  @Column({ name: 'storage_key', type: 'text' })
  storageKey!: string;

  @Column({ name: 'mime_type', type: 'text' })
  mimeType!: string;

  @Column({ name: 'byte_size', type: 'bigint' })
  byteSize!: string;

  @Column({ type: 'text' })
  sha256!: string;

  @Column({ type: 'text' })
  purpose!: AttachmentPurpose;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'receipt_drafts' })
@Index('idx_receipt_drafts_group_state_created', ['groupId', 'state', 'createdAt'])
export class ReceiptDraftEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'attachment_id', type: 'uuid', nullable: true })
  attachmentId!: string | null;

  @Column({ type: 'text' })
  source!: ReceiptDraftSource;

  @Column({ type: 'text' })
  state!: ReceiptDraftState;

  @Column({ name: 'merchant_name', type: 'text', nullable: true })
  merchantName!: string | null;

  @Column({ name: 'receipt_date', type: 'date', nullable: true })
  receiptDate!: string | null;

  @Column({ name: 'currency_code', type: 'char', length: 3, default: 'INR' })
  currencyCode!: string;

  @Column({ name: 'subtotal_minor', type: 'bigint', nullable: true })
  subtotalMinor!: string | null;

  @Column({ name: 'tax_minor', type: 'bigint', nullable: true })
  taxMinor!: string | null;

  @Column({ name: 'total_minor', type: 'bigint', nullable: true })
  totalMinor!: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 4, nullable: true })
  confidence!: string | null;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'receipt_ocr_results' })
@Index('idx_receipt_ocr_results_draft_created', ['receiptDraftId', 'createdAt'])
export class ReceiptOcrResultEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'receipt_draft_id', type: 'uuid' })
  receiptDraftId!: string;

  @Column({ type: 'text' })
  provider!: string;

  @Column({ name: 'raw_text', type: 'text' })
  rawText!: string;

  @Column({ name: 'raw_json', type: 'jsonb' })
  rawJson!: JsonObject;

  @Column({ type: 'numeric', precision: 5, scale: 4 })
  confidence!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'receipt_draft_items' })
@Index('idx_receipt_draft_items_draft_position', ['receiptDraftId', 'position'])
export class ReceiptDraftItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'receipt_draft_id', type: 'uuid' })
  receiptDraftId!: string;

  @Column({ type: 'text' })
  label!: string;

  @Column({ name: 'amount_minor', type: 'bigint' })
  amountMinor!: string;

  @Column({ name: 'currency_code', type: 'char', length: 3 })
  currencyCode!: string;

  @Column({ type: 'numeric', precision: 5, scale: 4 })
  confidence!: string;

  @Column({ type: 'integer' })
  position!: number;
}

@Entity({ name: 'capture_jobs' })
@Index('idx_capture_jobs_user_state_created', ['userId', 'state', 'createdAt'])
export class CaptureJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  source!: CaptureSource;

  @Column({ name: 'raw_text', type: 'text', nullable: true })
  rawText!: string | null;

  @Column({ name: 'attachment_id', type: 'uuid', nullable: true })
  attachmentId!: string | null;

  @Column({ type: 'text' })
  state!: string;

  @Column({ name: 'parsed_result', type: 'jsonb', nullable: true })
  parsedResult!: JsonObject | null;

  @Column({ name: 'consent_record_id', type: 'uuid', nullable: true })
  consentRecordId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
