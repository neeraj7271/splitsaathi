import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type UserState = 'active' | 'disabled';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 80 })
  displayName!: string;

  @Column({ name: 'avatar_attachment_id', type: 'uuid', nullable: true })
  avatarAttachmentId!: string | null;

  @Column({ name: 'upi_vpa', type: 'varchar', length: 120, nullable: true })
  upiVpa?: string | null;

  @Column({ name: 'default_currency_code', type: 'char', length: 3, default: 'INR' })
  defaultCurrencyCode!: string;

  @Column({ type: 'varchar', length: 24, default: 'active' })
  state!: UserState;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
