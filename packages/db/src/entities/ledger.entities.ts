import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import type { IdempotencyStatus, JsonObject, OfflineCommandStatus, PostingType } from './types';

@Entity({ name: 'event_store' })
@Index('uq_event_store_stream_version', ['streamId', 'version'], { unique: true })
@Index('idx_event_store_group_position', ['groupId', 'globalPosition'])
@Index('idx_event_store_event_type_occurred_at', ['eventType', 'occurredAt'])
export class EventStoreEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'stream_id', type: 'text' })
  streamId!: string;

  @Column({ name: 'aggregate_type', type: 'text' })
  aggregateType!: string;

  @Column({ name: 'aggregate_id', type: 'uuid' })
  aggregateId!: string;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId!: string | null;

  @Column({ type: 'integer' })
  version!: number;

  @Column({ name: 'global_position', type: 'bigint', insert: false, update: false })
  globalPosition!: string;

  @Column({ name: 'event_type', type: 'text' })
  eventType!: string;

  @Column({ name: 'event_schema_version', type: 'integer' })
  eventSchemaVersion!: number;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @Column({ name: 'idempotency_key', type: 'text', nullable: true })
  idempotencyKey!: string | null;

  @Column({ name: 'correlation_id', type: 'uuid' })
  correlationId!: string;

  @Column({ name: 'causation_id', type: 'uuid', nullable: true })
  causationId!: string | null;

  @Column({ name: 'occurred_at', type: 'timestamptz', default: () => 'now()' })
  occurredAt!: Date;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload!: JsonObject;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: JsonObject;

  @Column({ name: 'previous_hash', type: 'text', nullable: true })
  previousHash!: string | null;

  @Column({ name: 'event_hash', type: 'text' })
  eventHash!: string;
}

@Entity({ name: 'ledger_postings' })
@Index('idx_ledger_postings_group_participant_currency', ['groupId', 'participantId', 'currencyCode'])
@Index('idx_ledger_postings_source', ['sourceType', 'sourceId'])
@Index('idx_ledger_postings_event_id', ['eventId'])
export class LedgerPostingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'participant_id', type: 'uuid' })
  participantId!: string;

  @Column({ name: 'currency_code', type: 'char', length: 3 })
  currencyCode!: string;

  @Column({ name: 'signed_amount_minor', type: 'bigint' })
  signedAmountMinor!: string;

  @Column({ name: 'posting_type', type: 'text' })
  postingType!: PostingType;

  @Column({ name: 'source_type', type: 'text' })
  sourceType!: string;

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'idempotency_records' })
@Index('uq_idempotency_records_scope_actor_key', ['scope', 'actorKey', 'idempotencyKey'], { unique: true })
export class IdempotencyRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  scope!: string;

  @Column({ name: 'actor_key', type: 'text' })
  actorKey!: string;

  @Column({ name: 'idempotency_key', type: 'text' })
  idempotencyKey!: string;

  @Column({ name: 'request_hash', type: 'text' })
  requestHash!: string;

  @Column({ type: 'text' })
  status!: IdempotencyStatus;

  @Column({ name: 'response_snapshot', type: 'jsonb', nullable: true })
  responseSnapshot!: JsonObject | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;
}

@Entity({ name: 'projection_checkpoints' })
export class ProjectionCheckpointEntity {
  @PrimaryColumn({ name: 'projector_name', type: 'text' })
  projectorName!: string;

  @Column({ name: 'last_global_position', type: 'bigint', default: '0' })
  lastGlobalPosition!: string;

  @Column({ name: 'projector_version', type: 'integer' })
  projectorVersion!: number;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}

@Entity({ name: 'group_balance_projection' })
@Index('idx_group_balance_projection_participant_currency', ['participantId', 'currencyCode'])
export class GroupBalanceProjectionEntity {
  @PrimaryColumn({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @PrimaryColumn({ name: 'participant_id', type: 'uuid' })
  participantId!: string;

  @PrimaryColumn({ name: 'currency_code', type: 'char', length: 3 })
  currencyCode!: string;

  @Column({ name: 'balance_minor', type: 'bigint', default: '0' })
  balanceMinor!: string;

  @Column({ name: 'last_global_position', type: 'bigint', default: '0' })
  lastGlobalPosition!: string;
}

@Entity({ name: 'activity_feed_projection' })
@Index('idx_activity_feed_projection_group_occurred', ['groupId', 'occurredAt'])
export class ActivityFeedProjectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @Column({ name: 'activity_type', type: 'text' })
  activityType!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'amount_minor', type: 'bigint', nullable: true })
  amountMinor!: string | null;

  @Column({ name: 'currency_code', type: 'char', length: 3, nullable: true })
  currencyCode!: string | null;

  @Column({ name: 'entity_type', type: 'text' })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId!: string;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;
}

@Entity({ name: 'search_projection' })
@Index('idx_search_projection_group_occurred', ['groupId', 'occurredAt'])
export class SearchProjectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'entity_type', type: 'text' })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'amount_minor', type: 'bigint', nullable: true })
  amountMinor!: string | null;

  @Column({ name: 'currency_code', type: 'char', length: 3, nullable: true })
  currencyCode!: string | null;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ name: 'search_vector', type: 'tsvector', select: false, insert: false, update: false })
  searchVector!: string;
}

@Entity({ name: 'settlement_suggestion_projection' })
@Index('idx_settlement_suggestion_projection_group_state', ['groupId', 'state', 'createdAt'])
export class SettlementSuggestionProjectionEntity {
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

  @Column({ type: 'text', default: 'active' })
  state!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  explanation!: JsonObject;

  @Column({ name: 'last_global_position', type: 'bigint', default: '0' })
  lastGlobalPosition!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'sync_projection_changes' })
@Index('idx_sync_projection_changes_group_position', ['groupId', 'globalPosition'])
@Index('idx_sync_projection_changes_user_position', ['userId', 'globalPosition'])
export class SyncProjectionChangeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'global_position', type: 'bigint' })
  globalPosition!: string;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId!: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ name: 'entity_type', type: 'text' })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId!: string;

  @Column({ name: 'change_type', type: 'text' })
  changeType!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload!: JsonObject;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'audit_log_entries' })
@Index('idx_audit_log_entries_entity_created', ['entityType', 'entityId', 'createdAt'])
@Index('idx_audit_log_entries_group_created', ['groupId', 'createdAt'])
export class AuditLogEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_id', type: 'uuid', nullable: true })
  eventId!: string | null;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId!: string | null;

  @Column({ name: 'entity_type', type: 'text' })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId!: string;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @Column({ type: 'text' })
  action!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  diff!: JsonObject;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'offline_command_queue' })
@Index('uq_offline_command_queue_client_mutation_id', ['clientMutationId'], { unique: true })
@Index('idx_offline_command_queue_actor_status', ['actorUserId', 'status', 'createdAt'])
@Index('idx_offline_command_queue_group_status', ['groupId', 'status', 'createdAt'])
export class OfflineCommandQueueEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'client_mutation_id', type: 'uuid' })
  clientMutationId!: string;

  @Column({ name: 'actor_user_id', type: 'uuid' })
  actorUserId!: string;

  @Column({ name: 'device_id', type: 'uuid', nullable: true })
  deviceId!: string | null;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId!: string | null;

  @Column({ name: 'aggregate_type', type: 'text', nullable: true })
  aggregateType!: string | null;

  @Column({ name: 'aggregate_id', type: 'uuid', nullable: true })
  aggregateId!: string | null;

  @Column({ name: 'expected_aggregate_version', type: 'integer', nullable: true })
  expectedAggregateVersion!: number | null;

  @Column({ name: 'command_type', type: 'text' })
  commandType!: string;

  @Column({ name: 'idempotency_key', type: 'text' })
  idempotencyKey!: string;

  @Column({ type: 'jsonb' })
  payload!: JsonObject;

  @Column({ type: 'text' })
  status!: OfflineCommandStatus;

  @Column({ name: 'accepted_event_id', type: 'uuid', nullable: true })
  acceptedEventId!: string | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt!: Date | null;
}
