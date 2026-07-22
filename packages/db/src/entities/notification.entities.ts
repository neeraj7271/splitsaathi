import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type {
  JsonObject,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationTone,
  ReminderScheduleType
} from './types';

@Entity({ name: 'notifications' })
@Index('idx_notifications_user_read_created', ['userId', 'readAt', 'createdAt'])
@Index('idx_notifications_group_created', ['groupId', 'createdAt'])
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId!: string | null;

  @Column({ type: 'text' })
  type!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'entity_type', type: 'text', nullable: true })
  entityType!: string | null;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId!: string | null;

  @Column({ type: 'text' })
  tone!: NotificationTone;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'notification_deliveries' })
@Index('idx_notification_deliveries_notification_id', ['notificationId'])
@Index('idx_notification_deliveries_status', ['status'])
export class NotificationDeliveryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'notification_id', type: 'uuid' })
  notificationId!: string;

  @Column({ type: 'text', default: 'push' })
  channel!: NotificationChannel;

  @Column({ type: 'text' })
  provider!: string;

  @Column({ type: 'text' })
  status!: NotificationDeliveryStatus;

  @Column({ name: 'attempt_count', type: 'integer', default: 0 })
  attemptCount!: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @Column({ name: 'provider_message_id', type: 'text', nullable: true })
  providerMessageId!: string | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'reminder_schedules' })
@Index('idx_reminder_schedules_group_type', ['groupId', 'type'])
export class ReminderScheduleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ type: 'text' })
  type!: ReminderScheduleType;

  @Column({ type: 'jsonb' })
  schedule!: JsonObject;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId!: string;
}
