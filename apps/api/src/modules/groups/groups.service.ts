import {
  BadRequestException,
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
    let [participants, memberships] = await Promise.all([
      this.participants.find({ where: { groupId }, order: { createdAt: 'ASC' } }),
      this.memberships.find({ where: { groupId }, order: { createdAt: 'ASC' } })
    ]);

    // Repair orphan memberships whose participant row is missing from the group query,
    // and collapse guest shells superseded by a claimed/linked user participant.
    const repaired = await this.repairGroupPeople(groupId, participants, memberships);
    participants = repaired.participants;
    memberships = repaired.memberships;

    const membership = memberships.find((row) => row.userId === userId);
    const participantId = membership?.participantId ?? undefined;
    const netBalanceMinor = participantId
      ? this.balanceProjector.getParticipantBalance(group.id, participantId, group.baseCurrencyCode).amountMinor
      : 0;
    const upiVpaByParticipantId = await this.resolveUpiVpaByParticipantIds(participants);
    const [currentPermissions, memberPermissions] = await Promise.all([
      membership ? this.permissionsAllowed(groupId, membership.role) : Promise.resolve([] as GroupPermission[]),
      this.permissionsAllowed(groupId, 'member')
    ]);
    return GroupResponseDto.fromEntities(group, participants, memberships, netBalanceMinor, upiVpaByParticipantId, {
      canManageExpenses: currentPermissions.includes('financial.expense.edit.any'),
      membersCanEditExpenses: memberPermissions.includes('financial.expense.edit.any')
    });
  }

  async updateGroup(userId: string, groupId: string, dto: UpdateGroupDto): Promise<GroupResponseDto> {
    await this.assertPermission(userId, groupId, 'group.update');
    const group = await this.findGroupOrThrow(groupId);

    if (
      dto.name === undefined &&
      dto.imageAttachmentId === undefined &&
      dto.membersCanEditExpenses === undefined
    ) {
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

    if (dto.name !== undefined || dto.imageAttachmentId !== undefined) {
      await this.groups.save(group);
    }

    if (dto.membersCanEditExpenses !== undefined) {
      await this.setMemberExpenseEditAllowed(groupId, dto.membersCanEditExpenses);
    }

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
    const phoneE164 = await this.usersService.getPhoneE164ForUser(userId);
    const displayName = dto.displayName?.trim() || user.displayName;

    // Prefer linking an existing guest placeholder (same phone / unique matching name)
    // so we do not create a second "Unknown"/duplicate person in the group.
    const guest = await this.findClaimableGuestParticipant(invite.groupId, phoneE164, displayName);
    if (guest) {
      guest.linkedUserId = userId;
      guest.kind = 'user';
      guest.displayName = displayName;
      if (phoneE164) {
        guest.phoneE164 = phoneE164;
      }
      await this.participants.save(guest);

      let membership = await this.memberships.findOne({
        where: { groupId: invite.groupId, participantId: guest.id }
      });
      if (membership) {
        membership.userId = userId;
        if (membership.status !== 'active' && membership.status !== 'locked_for_exit') {
          membership.status = 'active';
          membership.lockedAt = null;
          membership.exitLockReason = null;
        }
        await this.memberships.save(membership);
      } else {
        await this.memberships.save(
          this.memberships.create({
            groupId: invite.groupId,
            userId,
            participantId: guest.id,
            role: 'member',
            status: 'active',
            lockedAt: null,
            exitLockReason: null
          })
        );
      }
    } else {
      const participant = await this.participants.save(
        this.participants.create({
          groupId: invite.groupId,
          displayName,
          phoneE164,
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
    }

    invite.uses += 1;
    await this.invites.save(invite);
    await this.notificationsService.create({
      userId,
      groupId: invite.groupId,
      type: 'invite_claimed',
      title: 'Invite accepted',
      body: `You joined ${await this.getGroupName(invite.groupId)} through an invite link.`,
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
      const groupName = await this.getGroupName(groupId);
      await this.notificationsService.create({
        userId: dto.linkedUserId,
        groupId,
        type: 'participant_added',
        title: 'Added to a group',
        body: `You were added to ${groupName}.`,
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
      const groupName = await this.getGroupName(groupId);
      await this.notificationsService.create({
        userId: saved.userId,
        groupId,
        type: 'membership_role_changed',
        title: 'Group role updated',
        body: `${groupName} · Your role is now ${saved.role}.`,
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

  async unarchiveGroup(userId: string, groupId: string): Promise<GroupResponseDto> {
    await this.assertPermission(userId, groupId, 'group.archive');
    const group = await this.findGroupOrThrow(groupId);
    group.state = 'active';
    group.archivedAt = null;
    await this.groups.save(group);
    await this.notifyActiveUsers(groupId, {
      type: 'group_unarchived',
      title: 'Group restored',
      body: `${group.name} was unarchived.`,
      data: { groupId }
    });
    return this.getGroupForUser(userId, groupId);
  }

  async leaveGroup(userId: string, groupId: string): Promise<MembershipResponseDto> {
    const membership = await this.memberships.findOne({
      where: { groupId, userId, status: In(['active', 'locked_for_exit']) }
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this group.');
    }
    return this.removeMembershipWithBalanceCheck(groupId, membership);
  }

  async removeMembership(
    userId: string,
    groupId: string,
    membershipId: string
  ): Promise<MembershipResponseDto> {
    await this.assertPermission(userId, groupId, 'membership.exit.lock');
    const membership = await this.findMembershipInGroupOrThrow(groupId, membershipId);
    return this.removeMembershipWithBalanceCheck(groupId, membership);
  }

  async resolveUserIdForParticipant(groupId: string, participantId: string): Promise<string | null> {
    const membership = await this.memberships.findOne({
      where: { groupId, participantId, status: In(['active', 'locked_for_exit']) }
    });
    if (membership?.userId) {
      return membership.userId;
    }
    const participant = await this.participants.findOne({ where: { id: participantId, groupId } });
    return participant?.linkedUserId ?? null;
  }

  async listActiveMemberUserIds(groupId: string): Promise<string[]> {
    const memberships = await this.memberships.find({
      where: { groupId, status: In(['active', 'locked_for_exit']) }
    });
    return memberships
      .map((membership) => membership.userId)
      .filter((id): id is string => Boolean(id));
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
      const groupName = await this.getGroupName(groupId);
      await this.notificationsService.create({
        userId: saved.userId,
        groupId,
        type: 'membership_exit_locked',
        title: 'Group access changed',
        body: `${groupName} · Your membership is locked for exit until balances are resolved.`,
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
      const groupName = await this.getGroupName(groupId);
      await this.notificationsService.create({
        userId: saved.userId,
        groupId,
        type: 'membership_exit_unlocked',
        title: 'Group access restored',
        body: `${groupName} · Your membership exit lock was removed.`,
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

  private async setMemberExpenseEditAllowed(groupId: string, allowed: boolean): Promise<void> {
    const existing = await this.rolePermissions.count({ where: { groupId, role: 'member' } });
    if (existing === 0) {
      // Materialize member defaults first so toggling does not replace the fallback with a partial set.
      await this.rolePermissions.save(
        permissionsForRole('member').map((permission) =>
          this.rolePermissions.create({
            groupId,
            role: 'member',
            permission,
            allowed: true
          })
        )
      );
    }

    const permissions: GroupPermission[] = ['financial.expense.edit.any', 'financial.expense.void'];
    for (const permission of permissions) {
      let row = await this.rolePermissions.findOne({
        where: { groupId, role: 'member', permission }
      });
      if (!row) {
        row = this.rolePermissions.create({
          groupId,
          role: 'member',
          permission,
          allowed
        });
      } else {
        row.allowed = allowed;
      }
      await this.rolePermissions.save(row);
    }
  }

  async getGroupName(groupId: string): Promise<string> {
    const group = await this.groups.findOne({ where: { id: groupId }, select: ['id', 'name'] });
    return group?.name?.trim() || 'a group';
  }

  async resolveUpiVpaForParticipant(groupId: string, participantId: string): Promise<string | null> {
    const userId = await this.resolveUserIdForParticipant(groupId, participantId);
    if (!userId) {
      return null;
    }
    const user = await this.usersService.findById(userId);
    const vpa = user?.upiVpa?.trim();
    return vpa || null;
  }

  private async resolveUpiVpaByParticipantIds(
    participants: ParticipantEntity[]
  ): Promise<Record<string, string | null>> {
    const linkedUserIds = participants
      .map((participant) => participant.linkedUserId)
      .filter((id): id is string => Boolean(id));
    if (!linkedUserIds.length) {
      return {};
    }
    const uniqueUserIds = [...new Set(linkedUserIds)];
    const users = await Promise.all(uniqueUserIds.map((id) => this.usersService.findById(id)));
    const upiByUserId = new Map(
      users
        .filter((user): user is NonNullable<typeof user> => Boolean(user))
        .map((user) => [user.id, user.upiVpa?.trim() || null] as const)
    );
    const result: Record<string, string | null> = {};
    for (const participant of participants) {
      result[participant.id] = participant.linkedUserId
        ? upiByUserId.get(participant.linkedUserId) ?? null
        : null;
    }
    return result;
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

  private async removeMembershipWithBalanceCheck(
    groupId: string,
    membership: GroupMembershipEntity
  ): Promise<MembershipResponseDto> {
    if (membership.role === 'owner') {
      throw new ForbiddenException(
        'Owners cannot leave or be removed. Transfer ownership or archive the group first.'
      );
    }
    if (membership.status === 'locked_for_exit') {
      throw new BadRequestException(
        'Membership is locked for exit until balances are resolved.'
      );
    }
    if (membership.status !== 'active') {
      throw new BadRequestException('Membership is not active.');
    }

    if (!membership.participantId) {
      throw new BadRequestException('Membership has no linked participant to check balances.');
    }

    const outstanding = this.balanceProjector
      .listGroupBalances(groupId)
      .filter(
        (row) =>
          row.participantId === membership.participantId && Math.abs(row.amountMinor) > 0
      );
    if (outstanding.length > 0) {
      const detail = outstanding
        .map((row) => `${row.amountMinor} ${row.currencyCode}`)
        .join(', ');
      throw new BadRequestException(
        `Settle outstanding balances before leaving (${detail}).`
      );
    }

    const group = await this.findGroupOrThrow(groupId);
    const leavingUserId = membership.userId;
    membership.status = 'removed_zero_balance';
    const saved = await this.memberships.save(membership);

    await this.notifyActiveUsers(
      groupId,
      {
        type: 'membership_removed',
        title: 'Member left the group',
        body: `A member left ${group.name}.`,
        data: { groupId, membershipId: saved.id, participantId: saved.participantId }
      },
      leavingUserId ? new Set([leavingUserId]) : undefined
    );

    return MembershipResponseDto.fromEntity(saved);
  }

  private async findClaimableGuestParticipant(
    groupId: string,
    phoneE164: string | null,
    displayName: string
  ): Promise<ParticipantEntity | null> {
    if (phoneE164) {
      const byPhoneRows = await this.participants.find({ where: { groupId, phoneE164 } });
      const phoneGuest = byPhoneRows.find((row) => !row.linkedUserId);
      if (phoneGuest) {
        return phoneGuest;
      }
    }

    const guests = (await this.participants.find({ where: { groupId } })).filter((row) => !row.linkedUserId);
    const normalized = displayName.trim().toLowerCase();
    const nameMatches = guests.filter((row) => row.displayName.trim().toLowerCase() === normalized);
    if (nameMatches.length === 1) {
      return nameMatches[0];
    }
    return null;
  }

  private async repairGroupPeople(
    groupId: string,
    participants: ParticipantEntity[],
    memberships: GroupMembershipEntity[]
  ): Promise<{ participants: ParticipantEntity[]; memberships: GroupMembershipEntity[] }> {
    const participantById = new Map(participants.map((row) => [row.id, row]));
    const missingIds = memberships
      .map((row) => row.participantId)
      .filter((id): id is string => typeof id === 'string' && !participantById.has(id));
    if (missingIds.length) {
      const extras = await this.participants.find({ where: { id: In(missingIds) } });
      for (const extra of extras) {
        if (extra.groupId !== groupId) {
          // Orphan membership pointing outside this group — leave for UI filter.
          continue;
        }
        participants.push(extra);
        participantById.set(extra.id, extra);
      }
    }

    const linked = participants.filter((row) => Boolean(row.linkedUserId));
    const linkedPhones = new Set(linked.map((row) => row.phoneE164).filter((phone): phone is string => Boolean(phone)));
    const linkedNames = new Set(linked.map((row) => row.displayName.trim().toLowerCase()));

    let changed = false;
    for (const membership of memberships) {
      if (membership.status !== 'active' && membership.status !== 'locked_for_exit') {
        continue;
      }
      if (membership.userId || !membership.participantId) {
        continue;
      }
      const participant = participantById.get(membership.participantId);
      if (!participant || participant.linkedUserId) {
        continue;
      }
      const supersededByPhone = Boolean(participant.phoneE164 && linkedPhones.has(participant.phoneE164));
      const supersededByName = linkedNames.has(participant.displayName.trim().toLowerCase());
      if (!supersededByPhone && !supersededByName) {
        continue;
      }
      const outstanding = this.balanceProjector
        .listGroupBalances(groupId)
        .some((row) => row.participantId === participant.id && Math.abs(row.amountMinor) > 0);
      if (outstanding) {
        continue;
      }
      membership.status = 'removed_zero_balance';
      await this.memberships.save(membership);
      changed = true;
    }

    if (changed) {
      memberships = await this.memberships.find({ where: { groupId }, order: { createdAt: 'ASC' } });
    }

    return { participants, memberships };
  }

  private async notifyActiveUsers(
    groupId: string,
    input: {
      type: string;
      title: string;
      body: string;
      data?: Record<string, unknown>;
    },
    excludeUserIds?: Set<string>
  ): Promise<void> {
    const memberships = await this.memberships.find({
      where: { groupId, status: In(['active', 'locked_for_exit']) }
    });

    await Promise.all(
      memberships
        .filter((membership) => Boolean(membership.userId))
        .filter((membership) => !excludeUserIds?.has(membership.userId!))
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
