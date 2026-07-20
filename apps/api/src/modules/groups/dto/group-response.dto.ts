import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GroupInviteEntity } from '../entities/group-invite.entity';
import { GroupMembershipEntity } from '../entities/group-membership.entity';
import { GroupEntity } from '../entities/group.entity';
import { ParticipantEntity } from '../entities/participant.entity';

function toIso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

export class ParticipantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ nullable: true })
  phoneE164!: string | null;

  @ApiProperty()
  kind!: string;

  @ApiProperty({ nullable: true, format: 'uuid' })
  linkedUserId!: string | null;

  static fromEntity(entity: ParticipantEntity): ParticipantResponseDto {
    return {
      id: entity.id,
      displayName: entity.displayName,
      phoneE164: entity.phoneE164,
      kind: entity.kind,
      linkedUserId: entity.linkedUserId
    };
  }
}

export class MembershipResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ nullable: true, format: 'uuid' })
  userId!: string | null;

  @ApiProperty({ nullable: true, format: 'uuid' })
  participantId!: string | null;

  @ApiProperty()
  role!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ nullable: true })
  lockedAt!: string | null;

  static fromEntity(entity: GroupMembershipEntity): MembershipResponseDto {
    return {
      id: entity.id,
      userId: entity.userId,
      participantId: entity.participantId,
      role: entity.role,
      status: entity.status,
      lockedAt: toIso(entity.lockedAt)
    };
  }
}

export class GroupResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  mode!: string;

  @ApiProperty({ example: 'INR' })
  baseCurrencyCode!: string;

  @ApiProperty()
  state!: string;

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiPropertyOptional()
  category!: string | null;

  @ApiProperty()
  groupType!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  imageAttachmentId!: string | null;

  @ApiPropertyOptional()
  imageUrl!: string | null;

  @ApiProperty({ nullable: true })
  archivedAt!: string | null;

  @ApiProperty({ type: ParticipantResponseDto, isArray: true })
  participants!: ParticipantResponseDto[];

  @ApiProperty({ type: MembershipResponseDto, isArray: true })
  memberships!: MembershipResponseDto[];

  @ApiPropertyOptional({ description: "Current user's net balance in this group (positive = owed money, negative = owes money)" })
  netBalanceMinor?: number;

  static fromEntities(
    group: GroupEntity,
    participants: ParticipantEntity[],
    memberships: GroupMembershipEntity[],
    netBalanceMinor = 0
  ): GroupResponseDto {
    return {
      id: group.id,
      name: group.name,
      mode: group.mode,
      baseCurrencyCode: group.baseCurrencyCode,
      state: group.state,
      createdByUserId: group.createdByUserId,
      category: group.category ?? null,
      groupType: group.groupType,
      imageAttachmentId: group.imageAttachmentId ?? null,
      imageUrl: group.imageAttachmentId ? `/v1/attachments/${group.imageAttachmentId}/content` : null,
      archivedAt: toIso(group.archivedAt),
      participants: participants.map(ParticipantResponseDto.fromEntity),
      memberships: memberships.map(MembershipResponseDto.fromEntity),
      netBalanceMinor
    };
  }
}

export class GroupSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  mode!: string;

  @ApiProperty({ example: 'INR' })
  baseCurrencyCode!: string;

  @ApiProperty()
  state!: string;

  @ApiProperty()
  currentUserRole!: string;

  @ApiProperty()
  participantCount!: number;

  @ApiPropertyOptional()
  category!: string | null;

  @ApiProperty()
  groupType!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  imageAttachmentId!: string | null;

  @ApiPropertyOptional()
  imageUrl!: string | null;

  @ApiPropertyOptional({ description: "Current user's net balance in this group (positive = owed money, negative = owes money)" })
  netBalanceMinor!: number;

  static fromEntities(
    group: GroupEntity,
    membership: GroupMembershipEntity,
    participantCount = 0,
    netBalanceMinor = 0
  ): GroupSummaryResponseDto {
    return {
      id: group.id,
      name: group.name,
      mode: group.mode,
      baseCurrencyCode: group.baseCurrencyCode,
      state: group.state,
      currentUserRole: membership.role,
      participantCount,
      category: group.category ?? null,
      groupType: group.groupType,
      imageAttachmentId: group.imageAttachmentId ?? null,
      imageUrl: group.imageAttachmentId ? `/v1/attachments/${group.imageAttachmentId}/content` : null,
      netBalanceMinor
    };
  }
}

export class InviteResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  groupId!: string;

  @ApiProperty()
  token!: string;

  @ApiProperty()
  joinUrl!: string;

  @ApiProperty()
  expiresAt!: string;

  @ApiProperty({ nullable: true })
  maxUses!: number | null;

  static fromEntity(entity: GroupInviteEntity, joinUrl: string): InviteResponseDto {
    return {
      id: entity.id,
      groupId: entity.groupId,
      token: entity.token,
      joinUrl,
      expiresAt: entity.expiresAt.toISOString(),
      maxUses: entity.maxUses
    };
  }
}

export class ObligationTransferResponseDto {
  @ApiProperty({ example: 'requires_ledger_module' })
  status!: string;

  @ApiProperty()
  message!: string;
}
