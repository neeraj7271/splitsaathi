import type { DomainEvent, Projector } from '../ledger';
import type { RecurringScheduleRow } from './recurring.types';

function cloneSchedule(row: RecurringScheduleRow): RecurringScheduleRow {
  return {
    ...row,
    template: {
      ...row.template,
      payers: row.template.payers.map((payer) => ({ ...payer })),
      shares: row.template.shares.map((share) => ({ ...share })),
      lineItems: row.template.lineItems?.map((item) => ({ ...item, participantIds: [...item.participantIds] })),
      billAdjustments: row.template.billAdjustments?.map((adjustment) => ({ ...adjustment }))
    },
    generatedExpenseIds: [...row.generatedExpenseIds]
  };
}

export class RecurringProjector implements Projector {
  readonly name = 'recurring_expense_schedules_projection';

  private readonly schedules = new Map<string, RecurringScheduleRow>();

  apply(event: DomainEvent): void {
    if (event.type === 'RecurringScheduleCreated') {
      const payload = event.payload as Omit<
        RecurringScheduleRow,
        'createdBy' | 'createdAt' | 'updatedAt' | 'generatedExpenseIds' | 'status'
      >;
      this.schedules.set(payload.recurringScheduleId, {
        ...payload,
        status: 'active',
        createdBy: event.actorId ?? 'system',
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
        generatedExpenseIds: []
      });
      return;
    }

    if (event.type === 'RecurringExpenseGenerated') {
      const payload = event.payload as {
        recurringScheduleId: string;
        expenseId: string;
        nextRunDate: string;
      };
      const schedule = this.schedules.get(payload.recurringScheduleId);
      if (!schedule) {
        throw new Error(`Cannot project recurring occurrence for missing schedule ${payload.recurringScheduleId}.`);
      }
      schedule.generatedExpenseIds.push(payload.expenseId);
      schedule.nextRunDate = payload.nextRunDate;
      schedule.updatedAt = event.occurredAt;
    }
  }

  listActiveSchedules(): RecurringScheduleRow[] {
    return [...this.schedules.values()]
      .filter((schedule) => schedule.status === 'active')
      .map((schedule) => cloneSchedule(schedule));
  }

  listGroupSchedules(groupId: string): RecurringScheduleRow[] {
    return [...this.schedules.values()]
      .filter((schedule) => schedule.groupId === groupId)
      .map((schedule) => cloneSchedule(schedule));
  }

  getSchedule(recurringScheduleId: string): RecurringScheduleRow | undefined {
    const schedule = this.schedules.get(recurringScheduleId);
    return schedule ? cloneSchedule(schedule) : undefined;
  }

  reset(): void {
    this.schedules.clear();
  }
}
