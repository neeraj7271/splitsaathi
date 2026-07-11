import { MembershipRole } from '@splitsaathi/contracts';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type MembershipStatus = 'active' | 'locked_for_exit' | 'inactive';

@Entity({ name: 'group_memberships' })
export class GroupMembershipEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ name: 'participant_id', type: 'uuid', nullable: true })
  participantId!: string | null;

  @Column({ type: 'varchar', length: 24 })
  role!: MembershipRole;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status!: MembershipStatus;

  @Column({ name: 'locked_at', type: 'timestamptz', nullable: true })
  lockedAt!: Date | null;

  @Column({ name: 'exit_lock_reason', type: 'varchar', length: 300, nullable: true })
  exitLockReason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
