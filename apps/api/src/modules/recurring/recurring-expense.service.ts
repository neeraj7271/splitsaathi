import { randomUUID } from 'node:crypto';
import { ExpenseCommandService } from '../expenses';
import { LedgerService, type DomainEvent } from '../ledger';
import { RecurringProjector } from './recurring.projector';
import type {
  CreateRecurringScheduleCommand,
  GenerateRecurringExpensesCommand,
  RecurringScheduleRow
} from './recurring.types';

function addCadence(dateValue: string, cadence: 'weekly' | 'monthly'): string {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid schedule date ${dateValue}.`);
  }
  if (cadence === 'weekly') {
    date.setUTCDate(date.getUTCDate() + 7);
  } else {
    date.setUTCMonth(date.getUTCMonth() + 1);
  }
  return date.toISOString().slice(0, 10);
}

export class RecurringExpenseService {
  constructor(
    private readonly ledger: LedgerService,
    private readonly recurring: RecurringProjector,
    private readonly expenses: ExpenseCommandService
  ) {}

  async createSchedule(command: CreateRecurringScheduleCommand): Promise<{ schedule: RecurringScheduleRow; events: DomainEvent[] }> {
    const recurringScheduleId = command.recurringScheduleId ?? randomUUID();
    const events = await this.ledger.appendAndProject({
      aggregateType: 'recurring_schedule',
      aggregateId: recurringScheduleId,
      expectedVersion: 0,
      idempotencyKey: command.idempotencyKey,
      idempotencyPayload: command,
      events: [
        {
          type: 'RecurringScheduleCreated',
          aggregateType: 'recurring_schedule',
          aggregateId: recurringScheduleId,
          groupId: command.groupId,
          actorId: command.actorId,
          payload: {
            recurringScheduleId,
            groupId: command.groupId,
            cadence: command.cadence,
            startDate: command.startDate,
            nextRunDate: command.startDate,
            template: command.template
          },
          metadata: { command: 'create_recurring_schedule' }
        }
      ]
    });
    const schedule = this.recurring.getSchedule(events[0].aggregateId);
    if (!schedule) {
      throw new Error(`Recurring schedule ${events[0].aggregateId} was not projected.`);
    }
    return { schedule, events };
  }

  async generateDue(command: GenerateRecurringExpensesCommand): Promise<{ generated: Array<{ scheduleId: string; expenseId: string }>; events: DomainEvent[] }> {
    const generated: Array<{ scheduleId: string; expenseId: string }> = [];
    const allEvents: DomainEvent[] = [];
    const asOf = command.asOfDate;

    for (const schedule of this.recurring.listActiveSchedules()) {
      if (schedule.nextRunDate > asOf) {
        continue;
      }
      const occurrenceDate = schedule.nextRunDate;
      const expenseResult = await this.expenses.createExpense({
        ...schedule.template,
        groupId: schedule.groupId,
        actorId: command.actorId,
        idempotencyKey: `${command.idempotencyKey}:${schedule.recurringScheduleId}:${occurrenceDate}`,
        description: `${schedule.template.description}`,
        expenseDate: occurrenceDate
      });
      allEvents.push(...expenseResult.events);

      const nextRunDate = addCadence(occurrenceDate, schedule.cadence);
      const occurrenceEvents = await this.ledger.appendAndProject({
        aggregateType: 'recurring_schedule',
        aggregateId: schedule.recurringScheduleId,
        expectedVersion: await this.ledger.getVersion('recurring_schedule', schedule.recurringScheduleId),
        idempotencyKey: `${command.idempotencyKey}:occurrence:${schedule.recurringScheduleId}:${occurrenceDate}`,
        idempotencyPayload: {
          scheduleId: schedule.recurringScheduleId,
          occurrenceDate,
          expenseId: expenseResult.expense.expenseId
        },
        events: [
          {
            type: 'RecurringExpenseGenerated',
            aggregateType: 'recurring_schedule',
            aggregateId: schedule.recurringScheduleId,
            groupId: schedule.groupId,
            actorId: command.actorId,
            payload: {
              recurringScheduleId: schedule.recurringScheduleId,
              occurrenceDate,
              expenseId: expenseResult.expense.expenseId,
              nextRunDate
            },
            metadata: { command: 'generate_recurring_expense' }
          }
        ]
      });
      allEvents.push(...occurrenceEvents);
      generated.push({ scheduleId: schedule.recurringScheduleId, expenseId: expenseResult.expense.expenseId });
    }

    return { generated, events: allEvents };
  }
}
