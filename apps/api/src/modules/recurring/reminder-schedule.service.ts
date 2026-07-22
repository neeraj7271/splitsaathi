import { randomUUID } from 'node:crypto';
import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ReminderScheduleEntity, type JsonObject, type ReminderScheduleType } from '@splitsaathi/db';
import { Repository } from 'typeorm';
import { BalanceProjector } from '../ledger/balance.projector';
import { GroupsService } from '../groups/groups.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface ReminderScheduleRecord {
  id: string;
  groupId: string;
  type: 'settlement_day' | 'recurring_expense' | 'stale_proof';
  schedule: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  status: 'active' | 'disabled';
}

export interface DueReminderRecord {
  scheduleId: string;
  groupId: string;
  type: ReminderScheduleRecord['type'];
  dueKey: string;
  title: string;
  body: string;
}

@Injectable()
export class ReminderScheduleService {
  private readonly schedules = new Map<string, ReminderScheduleRecord>();

  constructor(
    @Optional()
    @InjectRepository(ReminderScheduleEntity)
    private readonly repository?: Repository<ReminderScheduleEntity>,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly groups?: GroupsService,
    @Optional() private readonly balances?: BalanceProjector
  ) {}

  async create(input: Omit<ReminderScheduleRecord, 'id' | 'createdAt' | 'status'>): Promise<ReminderScheduleRecord> {
    if (this.repository) {
      const saved = await this.repository.save(
        this.repository.create({
          groupId: input.groupId,
          type: input.type as ReminderScheduleType,
          schedule: input.schedule as JsonObject,
          enabled: true,
          createdByUserId: input.createdBy
        })
      );
      return this.toRecord(saved);
    }

    const record: ReminderScheduleRecord = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      status: 'active'
    };
    this.schedules.set(record.id, record);
    return { ...record, schedule: { ...record.schedule } };
  }

  async listForGroup(groupId: string): Promise<ReminderScheduleRecord[]> {
    if (this.repository) {
      const rows = await this.repository.find({ where: { groupId }, order: { id: 'ASC' } });
      return rows.map((row) => this.toRecord(row));
    }

    return [...this.schedules.values()]
      .filter((schedule) => schedule.groupId === groupId)
      .map((schedule) => ({ ...schedule, schedule: { ...schedule.schedule } }));
  }

  async findDue(asOf = new Date()): Promise<DueReminderRecord[]> {
    const schedules = this.repository
      ? (await this.repository.find()).map((row) => this.toRecord(row))
      : [...this.schedules.values()].map((schedule) => ({ ...schedule, schedule: { ...schedule.schedule } }));
    return schedules.filter((schedule) => schedule.status === 'active').flatMap((schedule) => this.evaluate(schedule, asOf));
  }

  async processDue(asOf = new Date()): Promise<DueReminderRecord[]> {
    const due = await this.findDue(asOf);
    for (const reminder of due) {
      await this.deliverReminder(reminder);
      await this.markFired(reminder);
    }
    return due;
  }

  private async deliverReminder(reminder: DueReminderRecord): Promise<void> {
    if (!this.notifications || !this.groups) {
      return;
    }

    let userIds = await this.groups.listActiveMemberUserIds(reminder.groupId);
    if (reminder.type === 'settlement_day' && this.balances) {
      const debtorParticipantIds = new Set(
        this.balances
          .listGroupBalances(reminder.groupId)
          .filter((row) => row.amountMinor < 0)
          .map((row) => row.participantId)
      );
      if (debtorParticipantIds.size > 0) {
        const debtorUserIds: string[] = [];
        for (const participantId of debtorParticipantIds) {
          const userId = await this.groups.resolveUserIdForParticipant(reminder.groupId, participantId);
          if (userId) {
            debtorUserIds.push(userId);
          }
        }
        if (debtorUserIds.length > 0) {
          userIds = debtorUserIds;
        }
      }
    }

    await Promise.all(
      userIds.map((userId) =>
        this.notifications!.create({
          userId,
          groupId: reminder.groupId,
          type: `reminder_${reminder.type}`,
          title: reminder.title,
          body: reminder.body,
          data: {
            scheduleId: reminder.scheduleId,
            dueKey: reminder.dueKey,
            reminderType: reminder.type
          }
        })
      )
    );
  }

  private async markFired(reminder: DueReminderRecord): Promise<void> {
    if (this.repository) {
      const row = await this.repository.findOne({ where: { id: reminder.scheduleId } });
      if (!row) {
        return;
      }
      row.schedule = {
        ...row.schedule,
        lastFiredDueKey: reminder.dueKey,
        lastFiredAt: new Date().toISOString()
      };
      await this.repository.save(row);
      return;
    }

    const memory = this.schedules.get(reminder.scheduleId);
    if (!memory) {
      return;
    }
    memory.schedule = {
      ...memory.schedule,
      lastFiredDueKey: reminder.dueKey,
      lastFiredAt: new Date().toISOString()
    };
  }

  private evaluate(schedule: ReminderScheduleRecord, asOf: Date): DueReminderRecord[] {
    const hour = numberValue(schedule.schedule.hour, 9);
    if (asOf.getHours() !== hour) {
      return [];
    }
    const dayOfMonth = numberValue(schedule.schedule.dayOfMonth ?? schedule.schedule.day, undefined);
    if (dayOfMonth !== undefined && asOf.getDate() !== dayOfMonth) {
      return [];
    }
    const dayOfWeek = numberValue(schedule.schedule.dayOfWeek, undefined);
    if (dayOfWeek !== undefined && asOf.getDay() !== dayOfWeek) {
      return [];
    }
    const dueKey = `${schedule.id}:${asOf.toISOString().slice(0, 13)}`;
    if (schedule.schedule.lastFiredDueKey === dueKey) {
      return [];
    }
    return [
      {
        scheduleId: schedule.id,
        groupId: schedule.groupId,
        type: schedule.type,
        dueKey,
        title: titleFor(schedule.type),
        body: bodyFor(schedule.type)
      }
    ];
  }

  private toRecord(row: ReminderScheduleEntity): ReminderScheduleRecord {
    return {
      id: row.id,
      groupId: row.groupId,
      type: row.type,
      schedule: { ...row.schedule },
      createdBy: row.createdByUserId,
      createdAt: new Date().toISOString(),
      status: row.enabled ? 'active' : 'disabled'
    };
  }
}

function numberValue(value: unknown, fallback: number | undefined): number | undefined {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function titleFor(type: ReminderScheduleRecord['type']): string {
  switch (type) {
    case 'recurring_expense':
      return 'Recurring bill ready';
    case 'stale_proof':
      return 'Payment proof waiting';
    case 'settlement_day':
      return 'Settlement day';
  }
}

function bodyFor(type: ReminderScheduleRecord['type']): string {
  switch (type) {
    case 'recurring_expense':
      return 'A scheduled expense is ready to review.';
    case 'stale_proof':
      return 'A submitted payment proof is waiting for confirmation.';
    case 'settlement_day':
      return 'Balances are ready to review when convenient.';
  }
}
