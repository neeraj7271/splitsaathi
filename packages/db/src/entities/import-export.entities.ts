import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { ExportType, ImportItemStatus, ImportJobState, ImportSource, JsonObject } from './types';

@Entity({ name: 'import_jobs' })
@Index('idx_import_jobs_user_state_created', ['userId', 'state', 'createdAt'])
export class ImportJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  source!: ImportSource;

  @Column({ type: 'text' })
  state!: ImportJobState;

  @Column({ name: 'attachment_id', type: 'uuid' })
  attachmentId!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  summary!: JsonObject;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'import_items' })
@Index('idx_import_items_job_status', ['importJobId', 'status'])
export class ImportItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'import_job_id', type: 'uuid' })
  importJobId!: string;

  @Column({ name: 'external_id', type: 'text', nullable: true })
  externalId!: string | null;

  @Column({ name: 'item_type', type: 'text' })
  itemType!: string;

  @Column({ name: 'parsed_payload', type: 'jsonb' })
  parsedPayload!: JsonObject;

  @Column({ name: 'mapped_entity_type', type: 'text', nullable: true })
  mappedEntityType!: string | null;

  @Column({ name: 'mapped_entity_id', type: 'uuid', nullable: true })
  mappedEntityId!: string | null;

  @Column({ type: 'text' })
  status!: ImportItemStatus;
}

@Entity({ name: 'external_entity_maps' })
@Index('uq_external_entity_maps_source_external_entity', ['source', 'externalId', 'entityType'], { unique: true })
export class ExternalEntityMapEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  source!: string;

  @Column({ name: 'external_id', type: 'text' })
  externalId!: string;

  @Column({ name: 'entity_type', type: 'text' })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId!: string;
}

@Entity({ name: 'export_jobs' })
@Index('idx_export_jobs_user_state_created', ['userId', 'state', 'createdAt'])
export class ExportJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId!: string | null;

  @Column({ name: 'export_type', type: 'text' })
  exportType!: ExportType;

  @Column({ type: 'text' })
  state!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  parameters!: JsonObject;

  @Column({ name: 'file_attachment_id', type: 'uuid', nullable: true })
  fileAttachmentId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
}

@Entity({ name: 'statement_snapshots' })
@Index('idx_statement_snapshots_group_period', ['groupId', 'periodStart', 'periodEnd'])
export class StatementSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'period_start', type: 'date' })
  periodStart!: string;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd!: string;

  @Column({ name: 'currency_code', type: 'char', length: 3 })
  currencyCode!: string;

  @Column({ type: 'jsonb' })
  snapshot!: JsonObject;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
