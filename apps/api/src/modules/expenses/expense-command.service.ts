import { randomUUID } from 'node:crypto';
import type { LedgerPostingInput } from '@splitsaathi/domain';
import { ExpenseProjector, LedgerService, type DomainEvent, type ExpenseProjectionRow } from '../ledger';
import { ExpenseAllocationService } from './expense-allocation.service';
import type {
  CreateExpenseCommand,
  ExpensePayerInput,
  ExpenseSnapshot,
  ReviseExpenseCommand,
  VoidExpenseCommand
} from './expense.types';

function sumAmounts(rows: ExpensePayerInput[]): number {
  return rows.reduce((sum, row) => {
    if (!Number.isInteger(row.amountMinor)) {
      throw new Error('Payer amounts must use integer minor units.');
    }
    if (row.amountMinor <= 0) {
      throw new Error('Payer amounts must be positive.');
    }
    return sum + row.amountMinor;
  }, 0);
}

function snapshotPostings(snapshot: ExpenseSnapshot): LedgerPostingInput[] {
  return [
    ...snapshot.payers.map((payer) => ({
      participantId: payer.participantId,
      currencyCode: snapshot.currencyCode,
      signedAmountMinor: payer.amountMinor,
      postingType: 'expense_paid',
      sourceType: 'expense',
      sourceId: snapshot.expenseId
    })),
    ...snapshot.shares.map((share) => ({
      participantId: share.participantId,
      currencyCode: snapshot.currencyCode,
      signedAmountMinor: -share.amountMinor,
      postingType: 'expense_share',
      sourceType: 'expense',
      sourceId: snapshot.expenseId
    }))
  ];
}

function reversePostings(postings: LedgerPostingInput[], postingType: string): LedgerPostingInput[] {
  return postings.map((posting) => ({
    ...posting,
    signedAmountMinor: -posting.signedAmountMinor,
    postingType
  }));
}

export class ExpenseCommandService {
  constructor(
    private readonly ledger: LedgerService,
    private readonly expenses: ExpenseProjector,
    private readonly allocation = new ExpenseAllocationService()
  ) {}

  async createExpense(command: CreateExpenseCommand): Promise<{ expense: ExpenseProjectionRow; events: DomainEvent[] }> {
    const expense = this.materializeSnapshot(command.expenseId ?? randomUUID(), command);
    const events = await this.ledger.appendAndProject({
      aggregateType: 'expense',
      aggregateId: expense.expenseId,
      expectedVersion: 0,
      idempotencyKey: command.idempotencyKey,
      idempotencyPayload: command,
      events: [
        {
          type: 'ExpenseCreated',
          aggregateType: 'expense',
          aggregateId: expense.expenseId,
          groupId: expense.groupId,
          actorId: command.actorId,
          payload: { ...expense, reason: command.reason },
          postings: snapshotPostings(expense),
          metadata: { command: 'create_expense' }
        }
      ]
    });
    const projected = this.expenses.getExpense(events[0].aggregateId);
    if (!projected) {
      throw new Error(`Expense ${events[0].aggregateId} was not projected.`);
    }
    return { expense: projected, events };
  }

  async currentVersion(expenseId: string): Promise<number> {
    return this.ledger.getVersion('expense', expenseId);
  }

  async reviseExpense(command: ReviseExpenseCommand): Promise<{ expense: ExpenseProjectionRow; events: DomainEvent[] }> {
    const existing = this.expenses.getExpense(command.expenseId);
    if (!existing || existing.status === 'voided') {
      throw new Error(`Expense ${command.expenseId} is not active.`);
    }

    const expense = this.materializeSnapshot(command.expenseId, command);
    const postings = [
      ...reversePostings(snapshotPostings(existing), 'expense_adjustment_reversal'),
      ...snapshotPostings(expense).map((posting) => ({ ...posting, postingType: 'expense_adjustment_repost' }))
    ];

    const events = await this.ledger.appendAndProject({
      aggregateType: 'expense',
      aggregateId: command.expenseId,
      expectedVersion: command.expectedVersion,
      idempotencyKey: command.idempotencyKey,
      idempotencyPayload: command,
      events: [
        {
          type: 'ExpenseAdjusted',
          aggregateType: 'expense',
          aggregateId: command.expenseId,
          groupId: expense.groupId,
          actorId: command.actorId,
          payload: { ...expense, reason: command.reason },
          postings,
          metadata: { command: 'revise_expense', previousVersion: existing.version }
        }
      ]
    });
    const projected = this.expenses.getExpense(command.expenseId);
    if (!projected) {
      throw new Error(`Expense ${command.expenseId} was not projected.`);
    }
    return { expense: projected, events };
  }

  async voidExpense(command: VoidExpenseCommand): Promise<{ events: DomainEvent[] }> {
    const existing = this.expenses.getExpense(command.expenseId);
    if (!existing || existing.status === 'voided') {
      throw new Error(`Expense ${command.expenseId} is not active.`);
    }

    const events = await this.ledger.appendAndProject({
      aggregateType: 'expense',
      aggregateId: command.expenseId,
      expectedVersion: command.expectedVersion,
      idempotencyKey: command.idempotencyKey,
      idempotencyPayload: command,
      events: [
        {
          type: 'ExpenseVoided',
          aggregateType: 'expense',
          aggregateId: command.expenseId,
          groupId: command.groupId,
          actorId: command.actorId,
          payload: {
            expenseId: command.expenseId,
            groupId: command.groupId,
            reason: command.reason
          },
          postings: reversePostings(snapshotPostings(existing), 'expense_void_reversal'),
          metadata: { command: 'void_expense', previousVersion: existing.version }
        }
      ]
    });
    return { events };
  }

  private materializeSnapshot(
    expenseId: string,
    command: Omit<CreateExpenseCommand, 'expenseId'> & { expenseId?: string }
  ): ExpenseSnapshot {
    const currencyCode = command.currencyCode ?? 'INR';
    const totalAmountMinor = sumAmounts(command.payers);
    const allocation = this.allocation.calculate(
      totalAmountMinor,
      currencyCode,
      command.shares,
      command.lineItems ?? [],
      command.billAdjustments ?? []
    );
    const shareTotal = allocation.shares.reduce((sum, share) => sum + share.amountMinor, 0);
    if (shareTotal !== totalAmountMinor) {
      throw new Error(`Expense shares must equal payer total ${totalAmountMinor}; received ${shareTotal}.`);
    }

    return {
      expenseId,
      groupId: command.groupId,
      description: command.description,
      category: command.category,
      expenseDate: command.expenseDate,
      currencyCode,
      totalAmountMinor,
      payers: command.payers.map((payer) => ({ ...payer })),
      shares: allocation.shares,
      lineItems: (command.lineItems ?? []).map((item) => ({ ...item, participantIds: [...item.participantIds] })),
      billAdjustments: (command.billAdjustments ?? []).map((adjustment) => ({ ...adjustment }))
    };
  }
}
