import { randomUUID } from 'node:crypto';
import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ReminderScheduleEntity, type JsonObject, type ReminderScheduleType } from '@splitsaathi/db';
import { Repository } from 'typeorm';

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
    private readonly repository?: Repository<ReminderScheduleEntity>
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
    return [
      {
        scheduleId: schedule.id,
        groupId: schedule.groupId,
        type: schedule.type,
        dueKey: `${schedule.id}:${asOf.toISOString().slice(0, 13)}`,
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
