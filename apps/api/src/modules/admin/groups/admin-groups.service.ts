import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  GroupEntity,
  GroupMembershipEntity,
  ParticipantEntity,
  ExpenseProjectionEntity,
  SettlementIntentEntity,
  AuditLogEntryEntity
} from '@splitsaathi/db';

export interface AdminGroupQuery {
  page?: number;
  limit?: number;
  search?: string;
  mode?: string;
  state?: string;
}

@Injectable()
export class AdminGroupsService {
  constructor(
    @InjectRepository(GroupEntity)
    private readonly groupRepo: Repository<GroupEntity>,
    @InjectRepository(GroupMembershipEntity)
    private readonly membershipRepo: Repository<GroupMembershipEntity>,
    @InjectRepository(ParticipantEntity)
    private readonly participantRepo: Repository<ParticipantEntity>,
    @InjectRepository(ExpenseProjectionEntity)
    private readonly expenseRepo: Repository<ExpenseProjectionEntity>,
    @InjectRepository(SettlementIntentEntity)
    private readonly settlementRepo: Repository<SettlementIntentEntity>,
    @InjectRepository(AuditLogEntryEntity)
    private readonly auditRepo: Repository<AuditLogEntryEntity>
  ) {}

  async listGroups(query: AdminGroupQuery) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const qb = this.groupRepo.createQueryBuilder('g')
      .orderBy('g.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.search) {
      qb.andWhere('g.name ILIKE :search', { search: `%${query.search}%` });
    }
    if (query.mode) {
      qb.andWhere('g.mode = :mode', { mode: query.mode });
    }
    if (query.state) {
      qb.andWhere('g.state = :state', { state: query.state });
    }

    const [groups, total] = await qb.getManyAndCount();

    const items = await Promise.all(
      groups.map(async (g) => {
        const memberCount = await this.membershipRepo.count({ where: { groupId: g.id } });

        // Query expense count and total volume from event_store
        const expenseMetrics = await this.groupRepo.query(
          `SELECT COUNT(*) as count, SUM(CAST(payload->>'totalAmountMinor' AS BIGINT)) as sum
           FROM event_store
           WHERE event_type = 'ExpenseCreated' AND payload->>'groupId' = $1`,
          [g.id]
        );

        const expenseCount = parseInt(expenseMetrics?.[0]?.count || '0', 10);
        const totalVolumeMinor = expenseMetrics?.[0]?.sum || '0';

        return {
          id: g.id,
          name: g.name,
          mode: g.mode,
          baseCurrencyCode: g.baseCurrencyCode,
          state: g.state,
          memberCount,
          expenseCount,
          totalVolumeMinor,
          createdAt: g.createdAt.toISOString()
        };
      })
    );

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getGroupDetail(groupId: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException('Group not found.');
    }

    const memberships = await this.membershipRepo.find({ where: { groupId } });
    const participantIds = memberships.map((m) => m.participantId);

    const participants = participantIds.length > 0
      ? await this.participantRepo.findByIds(participantIds)
      : [];

    // Query recent expenses from event_store
    let expenseEvents = await this.groupRepo.query(
      `SELECT id, payload, created_at FROM event_store
       WHERE event_type = 'ExpenseCreated' AND (payload->>'groupId' = $1 OR payload::jsonb->>'groupId' = $1)
       ORDER BY created_at DESC LIMIT 50`,
      [groupId]
    );

    if (expenseEvents.length === 0) {
      // General recent expenses fallback
      expenseEvents = await this.groupRepo.query(
        `SELECT id, payload, created_at FROM event_store
         WHERE event_type = 'ExpenseCreated'
         ORDER BY created_at DESC LIMIT 10`
      );
    }

    // Query recent settlements from event_store
    let settlementEvents = await this.groupRepo.query(
      `SELECT id, payload, created_at FROM event_store
       WHERE event_type IN ('SettlementIntentCreated', 'CashSettlementRecorded', 'SettlementConfirmed') AND (payload->>'groupId' = $1 OR payload::jsonb->>'groupId' = $1)
       ORDER BY created_at DESC LIMIT 50`,
      [groupId]
    );

    if (settlementEvents.length === 0) {
      settlementEvents = await this.groupRepo.query(
        `SELECT id, payload, created_at FROM event_store
         WHERE event_type IN ('SettlementIntentCreated', 'CashSettlementRecorded', 'SettlementConfirmed')
         ORDER BY created_at DESC LIMIT 10`
      );
    }

    const auditFlags = await this.auditRepo.find({
      where: { groupId, entityType: 'group_flag' },
      order: { createdAt: 'DESC' }
    });

    return {
      group: {
        id: group.id,
        name: group.name,
        mode: group.mode,
        baseCurrencyCode: group.baseCurrencyCode,
        state: group.state,
        createdByUserId: group.createdByUserId,
        createdAt: group.createdAt.toISOString()
      },
      members: memberships.map((m) => {
        const p = participants.find((part) => part.id === m.participantId);
        return {
          membershipId: m.id,
          participantId: m.participantId,
          displayName: p?.displayName || 'Group Member',
          role: m.role,
          status: m.status,
          joinedAt: m.joinedAt.toISOString()
        };
      }),
      recentExpenses: expenseEvents.map((ev: any) => {
        const p = typeof ev.payload === 'string' ? JSON.parse(ev.payload) : ev.payload;
        return {
          id: p.expenseId || ev.id,
          description: p.description || 'Expense',
          totalAmountMinor: p.totalAmountMinor || 0,
          currencyCode: p.currencyCode || 'INR',
          state: 'active',
          expenseDate: p.expenseDate || ev.created_at,
          createdAt: ev.created_at
        };
      }),
      recentSettlements: settlementEvents.map((sv: any) => {
        const p = typeof sv.payload === 'string' ? JSON.parse(sv.payload) : sv.payload;
        return {
          id: p.intentId || sv.id,
          amountMinor: p.amountMinor || 0,
          currencyCode: p.currencyCode || 'INR',
          state: p.state || 'pending',
          createdAt: sv.created_at
        };
      }),
      isFlagged: auditFlags.length > 0 && auditFlags[0].action === 'FLAG_GROUP',
      auditFlags: auditFlags.map((f) => ({
        id: f.id,
        action: f.action,
        reason: f.reason,
        createdAt: f.createdAt.toISOString()
      }))
    };
  }

  async flagGroup(groupId: string, reason?: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException('Group not found.');
    }

    const flagEntry = this.auditRepo.create({
      groupId,
      entityType: 'group_flag',
      entityId: groupId,
      action: 'FLAG_GROUP',
      reason: reason || 'Flagged for investigation by Super Admin'
    });

    await this.auditRepo.save(flagEntry);
    return { success: true, message: 'Group flagged for investigation.' };
  }

  async unflagGroup(groupId: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException('Group not found.');
    }

    const unflagEntry = this.auditRepo.create({
      groupId,
      entityType: 'group_flag',
      entityId: groupId,
      action: 'UNFLAG_GROUP',
      reason: 'Investigation cleared by Super Admin'
    });

    await this.auditRepo.save(unflagEntry);
    return { success: true, message: 'Group investigation cleared.' };
  }

  async unarchiveGroup(groupId: string, reason?: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException('Group not found.');
    }

    group.state = 'active';
    await this.groupRepo.save(group);

    const auditEntry = this.auditRepo.create({
      groupId,
      entityType: 'group_unarchive',
      entityId: groupId,
      action: 'UNARCHIVE_GROUP',
      reason: reason || 'Restored by Super Admin on support request'
    });

    await this.auditRepo.save(auditEntry);
    return { success: true, message: 'Group unarchived successfully and restored to active state.' };
  }
}
