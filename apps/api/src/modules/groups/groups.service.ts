import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MembershipRole } from '@splitsaathi/contracts';
import { randomBytes } from 'crypto';
import { In, Repository } from 'typeorm';
import { AttachmentEntity } from '@splitsaathi/db';
import { ApiConfigService } from '../../config/api-config.service';
import { BalanceProjector } from '../ledger/balance.projector';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { AddParticipantDto } from './dto/add-participant.dto';
import { ClaimInviteDto } from './dto/claim-invite.dto';
import { ChangeMembershipRoleDto } from './dto/change-membership-role.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import {
  GroupResponseDto,
  GroupSummaryResponseDto,
  InviteResponseDto,
  MembershipResponseDto,
  ObligationTransferResponseDto,
  ParticipantResponseDto
} from './dto/group-response.dto';
import { LockExitDto } from './dto/lock-exit.dto';
import { ObligationTransferDto } from './dto/obligation-transfer.dto';
import { GroupInviteEntity } from './entities/group-invite.entity';
import { GroupMembershipEntity } from './entities/group-membership.entity';
import { GroupRolePermissionEntity } from './entities/group-role-permission.entity';
import { GroupEntity } from './entities/group.entity';
import { ParticipantEntity } from './entities/participant.entity';
import {
  DEFAULT_ROLE_PERMISSIONS,
  GroupPermission,
  permissionsForRole
} from './policies/group-permissions';
import {
  OBLIGATION_TRANSFER_PORT,
  ObligationTransferPort
} from './ports/obligation-transfer.port';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(GroupEntity)
    private readonly groups: Repository<GroupEntity>,
    @InjectRepository(ParticipantEntity)
    private readonly participants: Repository<ParticipantEntity>,
    @InjectRepository(GroupMembershipEntity)
    private readonly memberships: Repository<GroupMembershipEntity>,
    @InjectRepository(GroupRolePermissionEntity)
    private readonly rolePermissions: Repository<GroupRolePermissionEntity>,
    @InjectRepository(GroupInviteEntity)
    private readonly invites: Repository<GroupInviteEntity>,
    @InjectRepository(AttachmentEntity)
    private readonly attachments: Repository<AttachmentEntity>,
    @Inject(OBLIGATION_TRANSFER_PORT)
    private readonly obligationTransferPort: ObligationTransferPort,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly config: ApiConfigService,
    private readonly balanceProjector: BalanceProjector
  ) {}

  async createGroup(userId: string, dto: CreateGroupDto): Promise<GroupResponseDto> {
    const creator = await this.usersService.findByIdOrThrow(userId);
    if (dto.imageAttachmentId) {
      await this.assertGroupImageAttachment(userId, dto.imageAttachmentId);
    }
    const group = await this.groups.save(
      this.groups.create({
        name: dto.name,
        mode: dto.mode,
        baseCurrencyCode: dto.baseCurrencyCode.toUpperCase(),
        category: dto.category?.trim() ?? null,
        groupType: dto.groupType,
        imageAttachmentId: dto.imageAttachmentId ?? null,
        state: 'active',
        createdByUserId: userId,
        archivedAt: null
      })
    );

    const ownerParticipant = await this.participants.save(
      this.participants.create({
        groupId: group.id,
        displayName: creator.displayName,
        phoneE164: null,
        kind: 'user',
        linkedUserId: userId,
        invitedByUserId: userId
      })
    );

    await this.memberships.save(
      this.memberships.create({
        groupId: group.id,
        userId,
        participantId: ownerParticipant.id,
        role: 'owner',
        status: 'active',
        lockedAt: null,
        exitLockReason: null
      })
    );

    for (const participant of dto.participants) {
      const savedParticipant = await this.participants.save(
        this.participants.create({
          groupId: group.id,
          displayName: participant.displayName,
          phoneE164: participant.phoneE164 ?? null,
          kind: 'guest',
          linkedUserId: null,
          invitedByUserId: userId
        })
      );
      await this.memberships.save(
        this.memberships.create({
          groupId: group.id,
          userId: null,
          participantId: savedParticipant.id,
          role: participant.role,
          status: 'active',
          lockedAt: null,
          exitLockReason: null
        })
      );
    }

    await this.seedDefaultPermissions(group.id);
    return this.getGroupForUser(userId, group.id);
  }

  async listGroups(userId: string): Promise<GroupSummaryResponseDto[]> {
    const currentMemberships = await this.memberships.find({
      where: { userId, status: In(['active', 'locked_for_exit']) }
    });

    if (currentMemberships.length === 0) {
      return [];
    }

    const groupIds = currentMemberships.map((membership) => membership.groupId);
    const groups = await this.groups.find({
      where: { id: In(groupIds) },
      order: { createdAt: 'DESC' }
    });
    const membershipByGroupId = new Map(
      currentMemberships.map((membership) => [membership.groupId, membership])
    );

    const countRows = await this.participants
      .createQueryBuilder('p')
      .select('p.group_id', 'groupId')
      .addSelect('COUNT(*)', 'cnt')
      .where('p.group_id IN (:...ids)', { ids: groupIds })
      .groupBy('p.group_id')
      .getRawMany<{ groupId: string; cnt: string }>();
    const countByGroupId = new Map(countRows.map((row) => [row.groupId, Number(row.cnt)]));

    return groups.map((group) => {
      const membership = membershipByGroupId.get(group.id)!;
      const participantId = membership.participantId ?? undefined;
      const netBalanceMinor = participantId
        ? this.balanceProjector.getParticipantBalance(group.id, participantId, group.baseCurrencyCode).amountMinor
        : 0;
      return GroupSummaryResponseDto.fromEntities(
        group,
        membership,
        countByGroupId.get(group.id) ?? 0,
        netBalanceMinor
      );
    });
  }

  async getGroupForUser(userId: string, groupId: string): Promise<GroupResponseDto> {
    await this.assertPermission(userId, groupId, 'group.read');
    const group = await this.findGroupOrThrow(groupId);
    const [participants, memberships] = await Promise.all([
      this.participants.find({ where: { groupId }, order: { createdAt: 'ASC' } }),
      this.memberships.find({ where: { groupId }, order: { createdAt: 'ASC' } })
    ]);
    const membership = memberships.find((row) => row.userId === userId);
    const participantId = membership?.participantId ?? undefined;
    const netBalanceMinor = participantId
      ? this.balanceProjector.getParticipantBalance(group.id, participantId, group.baseCurrencyCode).amountMinor
      : 0;
    return GroupResponseDto.fromEntities(group, participants, memberships, netBalanceMinor);
  }

  async updateGroup(userId: string, groupId: string, dto: UpdateGroupDto): Promise<GroupResponseDto> {
    await this.assertPermission(userId, groupId, 'group.update');
    const group = await this.findGroupOrThrow(groupId);

    if (dto.name === undefined && dto.imageAttachmentId === undefined) {
      return this.getGroupForUser(userId, groupId);
    }

    if (dto.name !== undefined) {
      group.name = dto.name.trim();
    }

    if (dto.imageAttachmentId !== undefined) {
      if (dto.imageAttachmentId) {
        await this.assertGroupImageAttachment(userId, dto.imageAttachmentId);
      }
      group.imageAttachmentId = dto.imageAttachmentId;
    }

    await this.groups.save(group);
    return this.getGroupForUser(userId, groupId);
  }

  async createInvite(userId: string, groupId: string, dto: CreateInviteDto): Promise<InviteResponseDto> {
    await this.assertPermission(userId, groupId, 'group.invite.create');
    await this.findGroupOrThrow(groupId);

    const invite = await this.invites.save(
      this.invites.create({
        groupId,
        token: randomBytes(24).toString('base64url'),
        createdByUserId: userId,
        expiresAt: this.addDays(new Date(), dto.expiresInDays),
        maxUses: dto.maxUses ?? null,
        uses: 0,
        status: 'active'
      })
    );

    return InviteResponseDto.fromEntity(invite, this.joinUrl(invite.token));
  }

  async previewInvite(token: string): Promise<InviteResponseDto> {
    const invite = await this.findUsableInviteOrThrow(token, false);
    return InviteResponseDto.fromEntity(invite, this.joinUrl(invite.token));
  }

  async claimInvite(userId: string, token: string, dto: ClaimInviteDto): Promise<GroupResponseDto> {
    const invite = await this.findUsableInviteOrThrow(token, true);
    const existing = await this.memberships.findOne({
      where: { groupId: invite.groupId, userId, status: In(['active', 'locked_for_exit']) }
    });
    if (existing) {
      return this.getGroupForUser(userId, invite.groupId);
    }

    const user = await this.usersService.findByIdOrThrow(userId);
    const participant = await this.participants.save(
      this.participants.create({
        groupId: invite.groupId,
        displayName: dto.displayName?.trim() || user.displayName,
        phoneE164: null,
        kind: 'user',
        linkedUserId: userId,
        invitedByUserId: invite.createdByUserId
      })
    );
    await this.memberships.save(
      this.memberships.create({
        groupId: invite.groupId,
        userId,
        participantId: participant.id,
        role: 'member',
        status: 'active',
        lockedAt: null,
        exitLockReason: null
      })
    );
    invite.uses += 1;
    await this.invites.save(invite);
    await this.notificationsService.create({
      userId,
      groupId: invite.groupId,
      type: 'invite_claimed',
      title: 'Invite accepted',
      body: 'You joined the group through an invite link.',
      data: { groupId: invite.groupId, inviteId: invite.id }
    });
    return this.getGroupForUser(userId, invite.groupId);
  }

  async addParticipant(
    userId: string,
    groupId: string,
    dto: AddParticipantDto
  ): Promise<ParticipantResponseDto> {
    await this.assertPermission(userId, groupId, 'participant.create');
    await this.findGroupOrThrow(groupId);

    const participant = await this.participants.save(
      this.participants.create({
        groupId,
        displayName: dto.displayName,
        phoneE164: dto.phoneE164 ?? null,
        kind: dto.linkedUserId ? 'user' : 'guest',
        linkedUserId: dto.linkedUserId ?? null,
        invitedByUserId: userId
      })
    );

    await this.memberships.save(
      this.memberships.create({
        groupId,
        userId: dto.linkedUserId ?? null,
        participantId: participant.id,
        role: dto.role,
        status: 'active',
        lockedAt: null,
        exitLockReason: null
      })
    );

    if (dto.linkedUserId) {
      await this.notificationsService.create({
        userId: dto.linkedUserId,
        groupId,
        type: 'participant_added',
        title: 'You were added to a group',
        body: `${dto.displayName} was added to this group.`,
        data: { groupId, participantId: participant.id }
      });
    }

    return ParticipantResponseDto.fromEntity(participant);
  }

  async changeMembershipRole(
    userId: string,
    groupId: string,
    membershipId: string,
    dto: ChangeMembershipRoleDto
  ): Promise<MembershipResponseDto> {
    await this.assertPermission(userId, groupId, 'membership.role.update');
    const membership = await this.findMembershipInGroupOrThrow(groupId, membershipId);

    if (membership.role === 'owner') {
      throw new ForbiddenException('Owner membership role cannot be changed through this endpoint.');
    }

    membership.role = dto.role;
    const saved = await this.memberships.save(membership);

    if (saved.userId) {
      await this.notificationsService.create({
        userId: saved.userId,
        groupId,
        type: 'membership_role_changed',
        title: 'Group role updated',
        body: `Your role in this group is now ${saved.role}.`,
        data: { groupId, membershipId: saved.id, role: saved.role }
      });
    }

    return MembershipResponseDto.fromEntity(saved);
  }

  async archiveGroup(userId: string, groupId: string): Promise<GroupResponseDto> {
    await this.assertPermission(userId, groupId, 'group.archive');
    const group = await this.findGroupOrThrow(groupId);
    group.state = 'archived';
    group.archivedAt = new Date();
    await this.groups.save(group);
    await this.notifyActiveUsers(groupId, {
      type: 'group_archived',
      title: 'Group archived',
      body: `${group.name} was archived.`,
      data: { groupId }
    });
    return this.getGroupForUser(userId, groupId);
  }

  async lockMembershipForExit(
    userId: string,
    groupId: string,
    membershipId: string,
    dto: LockExitDto
  ): Promise<MembershipResponseDto> {
    await this.assertPermission(userId, groupId, 'membership.exit.lock');
    const membership = await this.findMembershipInGroupOrThrow(groupId, membershipId);

    if (membership.role === 'owner') {
      throw new ForbiddenException('Owner membership cannot be locked for exit.');
    }

    membership.status = 'locked_for_exit';
    membership.lockedAt = new Date();
    membership.exitLockReason = dto.reason ?? null;
    const saved = await this.memberships.save(membership);

    if (saved.userId) {
      await this.notificationsService.create({
        userId: saved.userId,
        groupId,
        type: 'membership_exit_locked',
        title: 'Group access changed',
        body: 'Your membership is locked for exit until balances are resolved.',
        data: { groupId, membershipId: saved.id }
      });
    }

    return MembershipResponseDto.fromEntity(saved);
  }

  async unlockMembershipForExit(
    userId: string,
    groupId: string,
    membershipId: string
  ): Promise<MembershipResponseDto> {
    await this.assertPermission(userId, groupId, 'membership.exit.lock');
    const membership = await this.findMembershipInGroupOrThrow(groupId, membershipId);

    if (membership.status !== 'locked_for_exit') {
      return MembershipResponseDto.fromEntity(membership);
    }

    membership.status = 'active';
    membership.lockedAt = null;
    membership.exitLockReason = null;
    const saved = await this.memberships.save(membership);

    if (saved.userId) {
      await this.notificationsService.create({
        userId: saved.userId,
        groupId,
        type: 'membership_exit_unlocked',
        title: 'Group access restored',
        body: 'Your membership exit lock was removed.',
        data: { groupId, membershipId: saved.id }
      });
    }

    return MembershipResponseDto.fromEntity(saved);
  }

  async requestObligationTransfer(
    userId: string,
    groupId: string,
    dto: ObligationTransferDto
  ): Promise<ObligationTransferResponseDto> {
    await this.assertPermission(userId, groupId, 'obligation_transfer.create');
    await this.findMembershipInGroupOrThrow(groupId, dto.fromMembershipId);
    await this.findMembershipInGroupOrThrow(groupId, dto.toMembershipId);

    return this.obligationTransferPort.requestTransfer({
      ...dto,
      groupId,
      requestedByUserId: userId
    });
  }

  async assertPermission(userId: string, groupId: string, permission: GroupPermission): Promise<void> {
    const membership = await this.memberships.findOne({
      where: { groupId, userId, status: In(['active', 'locked_for_exit']) }
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this group.');
    }

    const allowed = await this.permissionsAllowed(groupId, membership.role);
    if (!allowed.includes(permission)) {
      throw new ForbiddenException('You do not have permission for this group action.');
    }
  }

  private async permissionsAllowed(groupId: string, role: MembershipRole): Promise<GroupPermission[]> {
    const rows = await this.rolePermissions.find({
      where: { groupId, role, allowed: true }
    });

    if (rows.length === 0) {
      return permissionsForRole(role);
    }

    return rows.map((row) => row.permission);
  }

  private async seedDefaultPermissions(groupId: string): Promise<void> {
    const rows = Object.entries(DEFAULT_ROLE_PERMISSIONS).flatMap(([role, permissions]) =>
      permissions.map((permission) =>
        this.rolePermissions.create({
          groupId,
          role: role as MembershipRole,
          permission,
          allowed: true
        })
      )
    );
    await this.rolePermissions.save(rows);
  }

  private async findGroupOrThrow(groupId: string): Promise<GroupEntity> {
    const group = await this.groups.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException('Group not found.');
    }
    return group;
  }

  private async assertGroupImageAttachment(userId: string, attachmentId: string): Promise<void> {
    const attachment = await this.attachments.findOne({ where: { id: attachmentId } });
    if (!attachment || attachment.ownerUserId !== userId || attachment.purpose !== 'group_image') {
      throw new ForbiddenException('Group image attachment is invalid.');
    }
  }

  private async findUsableInviteOrThrow(token: string, enforceUsage: boolean): Promise<GroupInviteEntity> {
    const invite = await this.invites.findOne({ where: { token } });
    if (!invite || invite.status !== 'active') {
      throw new NotFoundException('Invite not found.');
    }
    if (invite.expiresAt.getTime() <= Date.now()) {
      invite.status = 'expired';
      await this.invites.save(invite);
      throw new ForbiddenException('Invite has expired.');
    }
    if (enforceUsage && invite.maxUses !== null && invite.uses >= invite.maxUses) {
      throw new ForbiddenException('Invite use limit has been reached.');
    }
    return invite;
  }

  private async findMembershipInGroupOrThrow(
    groupId: string,
    membershipId: string
  ): Promise<GroupMembershipEntity> {
    const membership = await this.memberships.findOne({ where: { id: membershipId, groupId } });
    if (!membership) {
      throw new NotFoundException('Membership not found.');
    }
    return membership;
  }

  private async notifyActiveUsers(
    groupId: string,
    input: {
      type: string;
      title: string;
      body: string;
      data?: Record<string, unknown>;
    }
  ): Promise<void> {
    const memberships = await this.memberships.find({
      where: { groupId, status: In(['active', 'locked_for_exit']) }
    });

    await Promise.all(
      memberships
        .filter((membership) => Boolean(membership.userId))
        .map((membership) =>
          this.notificationsService.create({
            userId: membership.userId!,
            groupId,
            type: input.type,
            title: input.title,
            body: input.body,
            data: input.data
          })
        )
    );
  }

  private joinUrl(token: string): string {
    return `${this.config.env.APP_PUBLIC_URL.replace(/\/$/, '')}/join/${token}`;
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }
}
