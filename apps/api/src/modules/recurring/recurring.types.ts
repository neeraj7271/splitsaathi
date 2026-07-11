import type { CreateExpenseCommand } from '../expenses';

export type RecurringCadence = 'weekly' | 'monthly';

export interface RecurringExpenseTemplate
  extends Omit<CreateExpenseCommand, 'idempotencyKey' | 'actorId' | 'groupId' | 'expenseId' | 'expenseDate'> {
  expenseDate?: string;
}

export interface RecurringScheduleRow {
  recurringScheduleId: string;
  groupId: string;
  cadence: RecurringCadence;
  startDate: string;
  nextRunDate: string;
  status: 'active' | 'paused';
  template: RecurringExpenseTemplate;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  generatedExpenseIds: string[];
}

export interface CreateRecurringScheduleCommand {
  idempotencyKey: string;
  actorId: string;
  groupId: string;
  recurringScheduleId?: string;
  cadence: RecurringCadence;
  startDate: string;
  template: RecurringExpenseTemplate;
}

export interface GenerateRecurringExpensesCommand {
  idempotencyKey: string;
  actorId: string;
  asOfDate: string;
}
