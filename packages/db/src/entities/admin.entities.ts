import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import type { JsonObject } from './types';

export type AdminRole = 'super_admin' | 'ops_admin' | 'finance_admin' | 'read_only';
export type AdminUserStatus = 'active' | 'suspended';
export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type SupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type SupportSenderType = 'user' | 'admin' | 'system';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled';

@Entity({ name: 'admin_users' })
@Index('uq_admin_users_email', ['email'], { unique: true })
export class AdminUserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  email!: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash!: string;

  @Column({ name: 'full_name', type: 'text' })
  fullName!: string;

  @Column({ type: 'text', default: 'read_only' })
  role!: AdminRole;

  @Column({ type: 'text', default: 'active' })
  status!: AdminUserStatus;

  @Column({ name: 'totp_secret', type: 'text', nullable: true })
  totpSecret!: string | null;

  @Column({ name: 'totp_enabled', type: 'boolean', default: false })
  totpEnabled!: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'admin_refresh_sessions' })
@Index('idx_admin_refresh_sessions_admin_id', ['adminId'])
export class AdminRefreshSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'admin_id', type: 'uuid' })
  adminId!: string;

  @Column({ name: 'refresh_token_hash', type: 'text' })
  refreshTokenHash!: string;

  @Column({ name: 'ip_address', type: 'text', nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'admin_audit_log' })
@Index('idx_admin_audit_log_admin_created', ['adminId', 'createdAt'])
@Index('idx_admin_audit_log_action_created', ['action', 'createdAt'])
@Index('idx_admin_audit_log_target', ['targetType', 'targetId'])
export class AdminAuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'admin_id', type: 'uuid' })
  adminId!: string;

  @Column({ type: 'text' })
  action!: string;

  @Column({ name: 'target_type', type: 'text' })
  targetType!: string;

  @Column({ name: 'target_id', type: 'text' })
  targetId!: string;

  @Column({ type: 'jsonb', nullable: true })
  before!: JsonObject | null;

  @Column({ type: 'jsonb', nullable: true })
  after!: JsonObject | null;

  @Column({ name: 'ip_address', type: 'text', nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'admin_support_tickets' })
@Index('idx_admin_support_tickets_user_status', ['userId', 'status'])
@Index('uq_admin_support_tickets_number', ['ticketNumber'], { unique: true })
export class AdminSupportTicketEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ticket_number', type: 'text' })
  ticketNumber!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  subject!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'text', default: 'open' })
  status!: SupportTicketStatus;

  @Column({ type: 'text', default: 'medium' })
  priority!: SupportTicketPriority;

  @Column({ name: 'assigned_admin_id', type: 'uuid', nullable: true })
  assignedAdminId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'admin_support_messages' })
@Index('idx_admin_support_messages_ticket_created', ['ticketId', 'createdAt'])
export class AdminSupportMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId!: string;

  @Column({ name: 'sender_type', type: 'text' })
  senderType!: SupportSenderType;

  @Column({ name: 'sender_id', type: 'uuid' })
  senderId!: string;

  @Column({ type: 'text' })
  body!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'admin_feature_flags' })
@Index('uq_admin_feature_flags_key', ['key'], { unique: true })
export class AdminFeatureFlagEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  key!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  @Column({ name: 'rollout_percentage', type: 'integer', default: 100 })
  rolloutPercentage!: number;

  @Column({ name: 'target_platforms', type: 'jsonb', default: () => "'[]'::jsonb" })
  targetPlatforms!: string[];

  @Column({ name: 'min_app_version', type: 'text', nullable: true })
  minAppVersion!: string | null;

  @Column({ name: 'updated_by_admin_id', type: 'uuid', nullable: true })
  updatedByAdminId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'admin_app_configs' })
@Index('uq_admin_app_configs_platform', ['platform'], { unique: true })
export class AdminAppConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  platform!: string;

  @Column({ name: 'min_supported_version', type: 'text', default: '1.0.0' })
  minSupportedVersion!: string;

  @Column({ name: 'latest_version', type: 'text', default: '1.0.0' })
  latestVersion!: string;

  @Column({ name: 'force_update_enabled', type: 'boolean', default: false })
  forceUpdateEnabled!: boolean;

  @Column({ type: 'text', nullable: true })
  changelog!: string | null;

  @Column({ name: 'updated_by_admin_id', type: 'uuid', nullable: true })
  updatedByAdminId!: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'admin_events' })
@Index('idx_admin_events_type_occurred', ['eventType', 'occurredAt'])
@Index('idx_admin_events_user_occurred', ['userId', 'occurredAt'])
export class AdminEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_type', type: 'text' })
  eventType!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId!: string | null;

  @Column({ name: 'amount_minor', type: 'bigint', nullable: true })
  amountMinor!: string | null;

  @Column({ name: 'currency_code', type: 'char', length: 3, nullable: true })
  currencyCode!: string | null;

  @Column({ type: 'text', nullable: true })
  platform!: string | null;

  @Column({ name: 'app_version', type: 'text', nullable: true })
  appVersion!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: JsonObject;

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;
}

@Entity({ name: 'billing_plans' })
@Index('uq_billing_plans_code', ['code'], { unique: true })
export class BillingPlanEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  code!: string;

  @Column({ name: 'amount_minor', type: 'bigint' })
  amountMinor!: string;

  @Column({ name: 'currency_code', type: 'char', length: 3, default: 'INR' })
  currencyCode!: string;

  @Column({ type: 'text', default: 'monthly' })
  interval!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  features!: JsonObject;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'subscriptions' })
@Index('idx_subscriptions_user_status', ['userId', 'status'])
export class SubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  @Column({ type: 'text', default: 'active' })
  status!: SubscriptionStatus;

  @Column({ name: 'mrr_amount_minor', type: 'bigint', default: '0' })
  mrrAmountMinor!: string;

  @Column({ name: 'currency_code', type: 'char', length: 3, default: 'INR' })
  currencyCode!: string;

  @Column({ name: 'current_period_start', type: 'timestamptz' })
  currentPeriodStart!: Date;

  @Column({ name: 'current_period_end', type: 'timestamptz' })
  currentPeriodEnd!: Date;

  @Column({ name: 'canceled_at', type: 'timestamptz', nullable: true })
  canceledAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
