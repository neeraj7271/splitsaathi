import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type {
  GroupMode,
  GroupPermission,
  GroupState,
  MembershipRole,
  MembershipStatus,
  ParticipantRelationshipType,
  ParticipantState,
  ParticipantType
} from './types';

@Entity({ name: 'groups' })
@Index('idx_groups_created_by_user_id', ['createdByUserId'])
@Index('idx_groups_state_created_at', ['state', 'createdAt'])
export class GroupEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  mode!: GroupMode;

  @Column({ name: 'base_currency_code', type: 'char', length: 3, default: 'INR' })
  baseCurrencyCode!: string;

  @Column({ type: 'text' })
  state!: GroupState;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;
}

@Entity({ name: 'participants' })
@Index('idx_participants_registered_user_id', ['registeredUserId'])
@Index('idx_participants_phone_hash', ['phoneHash'])
export class ParticipantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'registered_user_id', type: 'uuid', nullable: true })
  registeredUserId!: string | null;

  @Column({ name: 'participant_type', type: 'text' })
  participantType!: ParticipantType;

  @Column({ name: 'display_name', type: 'text' })
  displayName!: string;

  @Column({ name: 'phone_hash', type: 'text', nullable: true })
  phoneHash!: string | null;

  @Column({ name: 'guest_claim_token_hash', type: 'text', nullable: true })
  guestClaimTokenHash!: string | null;

  @Column({ type: 'text' })
  state!: ParticipantState;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'group_memberships' })
@Index('uq_group_memberships_group_participant', ['groupId', 'participantId'], { unique: true })
@Index('idx_group_memberships_participant_status', ['participantId', 'status'])
export class GroupMembershipEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'participant_id', type: 'uuid' })
  participantId!: string;

  @Column({ type: 'text' })
  role!: MembershipRole;

  @Column({ type: 'text' })
  status!: MembershipStatus;

  @Column({ name: 'joined_at', type: 'timestamptz', default: () => 'now()' })
  joinedAt!: Date;

  @Column({ name: 'left_at', type: 'timestamptz', nullable: true })
  leftAt!: Date | null;

  @Column({ name: 'locked_at', type: 'timestamptz', nullable: true })
  lockedAt!: Date | null;
}

@Entity({ name: 'participant_relationships' })
@Index('idx_participant_relationships_group_parent', ['groupId', 'parentParticipantId'])
@Index('uq_participant_relationships_group_parent_child_type', ['groupId', 'parentParticipantId', 'childParticipantId', 'relationshipType'], {
  unique: true
})
export class ParticipantRelationshipEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'parent_participant_id', type: 'uuid' })
  parentParticipantId!: string;

  @Column({ name: 'child_participant_id', type: 'uuid' })
  childParticipantId!: string;

  @Column({ name: 'relationship_type', type: 'text' })
  relationshipType!: ParticipantRelationshipType;

  @Column({ name: 'default_weight_numerator', type: 'bigint', default: '1' })
  defaultWeightNumerator!: string;

  @Column({ name: 'default_weight_denominator', type: 'bigint', default: '1' })
  defaultWeightDenominator!: string;

  @Column({ type: 'boolean', default: true })
  active!: boolean;
}

@Entity({ name: 'group_role_permissions' })
@Index('uq_group_role_permissions_group_role_permission', ['groupId', 'role', 'permission'], {
  unique: true
})
export class GroupRolePermissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ type: 'text' })
  role!: MembershipRole;

  @Column({ type: 'text' })
  permission!: GroupPermission;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;
}

@Entity({ name: 'group_invites' })
@Index('uq_group_invites_invite_token_hash', ['inviteTokenHash'], { unique: true })
@Index('idx_group_invites_group_id', ['groupId'])
export class GroupInviteEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId!: string;

  @Column({ name: 'invite_token_hash', type: 'text' })
  inviteTokenHash!: string;

  @Column({ name: 'intended_phone_hash', type: 'text', nullable: true })
  intendedPhoneHash!: string | null;

  @Column({ name: 'role_on_accept', type: 'text', default: 'member' })
  roleOnAccept!: MembershipRole;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;
}
