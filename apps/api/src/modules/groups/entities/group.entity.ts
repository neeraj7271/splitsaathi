import { GroupMode } from '@splitsaathi/contracts';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type GroupState = 'active' | 'archived';
export type GroupType = 'trip' | 'couple' | 'home' | 'event' | 'business' | 'other';

@Entity({ name: 'groups' })
export class GroupEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 24, default: 'flat' })
  mode!: GroupMode;

  @Column({ name: 'base_currency_code', type: 'char', length: 3, default: 'INR' })
  baseCurrencyCode!: string;

  @Column({ type: 'varchar', length: 24, default: 'active' })
  state!: GroupState;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  category!: string | null;

  @Column({ name: 'group_type', type: 'varchar', length: 24, default: 'other' })
  groupType!: GroupType;

  @Column({ name: 'image_attachment_id', type: 'uuid', nullable: true })
  imageAttachmentId!: string | null;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
