import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'notification_deliveries' })
export class NotificationDeliveryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'notification_id', type: 'uuid' })
  notificationId!: string;

  @Column({ type: 'varchar', length: 24, default: 'push' })
  channel!: 'push' | 'email' | 'in_app';

  @Column({ type: 'varchar', length: 60 })
  provider!: string;

  @Column({ type: 'varchar', length: 24 })
  status!: 'sent' | 'queued' | 'skipped' | 'failed';

  @Column({ name: 'provider_message_id', type: 'varchar', length: 160, nullable: true })
  providerMessageId!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  error!: string | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
