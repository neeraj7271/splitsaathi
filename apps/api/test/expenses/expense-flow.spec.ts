import { createFinancialTestApp } from '../support/financial-test-app';
import { OptimisticConcurrencyError } from '../../src/modules/ledger';

describe('expense lifecycle', () => {
  it('creates, revises, voids, and rebuilds projections from immutable events', async () => {
    const app = createFinancialTestApp();

    const created = await app.services.expenses.createExpense({
      idempotencyKey: 'expense-create-1',
      actorId: 'user-a',
      groupId: 'group-1',
      expenseId: 'expense-1',
      description: 'Dinner',
      expenseDate: '2026-07-10',
      currencyCode: 'INR',
      payers: [{ participantId: 'p-a', amountMinor: 10000 }],
      shares: [
        { participantId: 'p-a', shareType: 'equal' },
        { participantId: 'p-b', shareType: 'equal' }
      ]
    });

    expect(created.expense.totalAmountMinor).toBe(10000);
    expect(app.services.balances.getGroupBalances('group-1').balances).toEqual([
      { groupId: 'group-1', participantId: 'p-a', currencyCode: 'INR', amountMinor: 5000 },
      { groupId: 'group-1', participantId: 'p-b', currencyCode: 'INR', amountMinor: -5000 }
    ]);

    const revised = await app.services.expenses.reviseExpense({
      idempotencyKey: 'expense-revise-1',
      actorId: 'user-a',
      groupId: 'group-1',
      expenseId: 'expense-1',
      expectedVersion: 1,
      description: 'Dinner and dessert',
      expenseDate: '2026-07-10',
      currencyCode: 'INR',
      payers: [{ participantId: 'p-a', amountMinor: 12000 }],
      shares: [
        { participantId: 'p-a', shareType: 'exact', amountMinor: 4000 },
        { participantId: 'p-b', shareType: 'exact', amountMinor: 8000 }
      ],
      reason: 'Added dessert'
    });

    expect(revised.expense.version).toBe(2);
    expect(app.services.balances.getGroupBalances('group-1').balances).toEqual([
      { groupId: 'group-1', participantId: 'p-a', currencyCode: 'INR', amountMinor: 8000 },
      { groupId: 'group-1', participantId: 'p-b', currencyCode: 'INR', amountMinor: -8000 }
    ]);

    await app.services.expenses.voidExpense({
      idempotencyKey: 'expense-void-1',
      actorId: 'user-a',
      groupId: 'group-1',
      expenseId: 'expense-1',
      expectedVersion: 2,
      reason: 'Duplicate bill'
    });

    expect(app.projectors.expenses.getExpense('expense-1')?.status).toBe('voided');
    expect(app.projectors.expenses.listExpenseHistory('expense-1')).toHaveLength(3);
    expect(app.services.balances.getGroupBalances('group-1').balances).toEqual([]);
    expect(() => app.services.balances.assertZeroSum('group-1')).not.toThrow();

    await app.ledger.rebuildProjections();
    expect(app.projectors.expenses.getExpense('expense-1')?.status).toBe('voided');
    expect(app.services.balances.getGroupBalances('group-1').balances).toEqual([]);
  });

  it('rejects a stale concurrent expense revision against the same base version', async () => {
    const app = createFinancialTestApp();

    await app.services.expenses.createExpense({
      idempotencyKey: 'expense-concurrency-create',
      actorId: 'user-a',
      groupId: 'group-1',
      expenseId: 'expense-concurrency',
      description: 'Shared cab',
      expenseDate: '2026-07-10',
      currencyCode: 'INR',
      payers: [{ participantId: 'p-a', amountMinor: 6000 }],
      shares: [
        { participantId: 'p-a', shareType: 'equal' },
        { participantId: 'p-b', shareType: 'equal' }
      ]
    });

    await app.services.expenses.reviseExpense({
      idempotencyKey: 'expense-concurrency-revise-a',
      actorId: 'user-a',
      groupId: 'group-1',
      expenseId: 'expense-concurrency',
      expectedVersion: 1,
      description: 'Shared cab with toll',
      expenseDate: '2026-07-10',
      currencyCode: 'INR',
      payers: [{ participantId: 'p-a', amountMinor: 7000 }],
      shares: [
        { participantId: 'p-a', shareType: 'equal' },
        { participantId: 'p-b', shareType: 'equal' }
      ],
      reason: 'Added toll'
    });

    await expect(
      app.services.expenses.reviseExpense({
        idempotencyKey: 'expense-concurrency-revise-b',
        actorId: 'user-b',
        groupId: 'group-1',
        expenseId: 'expense-concurrency',
        expectedVersion: 1,
        description: 'Shared cab with parking',
        expenseDate: '2026-07-10',
        currencyCode: 'INR',
        payers: [{ participantId: 'p-a', amountMinor: 8000 }],
        shares: [
          { participantId: 'p-a', shareType: 'equal' },
          { participantId: 'p-b', shareType: 'equal' }
        ],
        reason: 'Added parking'
      })
    ).rejects.toBeInstanceOf(OptimisticConcurrencyError);

    expect(app.projectors.expenses.getExpense('expense-concurrency')?.version).toBe(2);
  });

  it('allocates itemized line items and bill adjustments deterministically', async () => {
    const app = createFinancialTestApp();

    const created = await app.services.expenses.createExpense({
      idempotencyKey: 'expense-itemized-create',
      actorId: 'user-a',
      groupId: 'group-itemized',
      expenseId: 'expense-itemized',
      description: 'Receipt with service and discount',
      expenseDate: '2026-07-10',
      currencyCode: 'INR',
      payers: [{ participantId: 'p-a', amountMinor: 10600 }],
      shares: [
        { participantId: 'p-a', shareType: 'itemized' },
        { participantId: 'p-b', shareType: 'itemized' },
        { participantId: 'p-c', shareType: 'itemized' }
      ],
      lineItems: [
        { label: 'Meals', amountMinor: 9000, participantIds: ['p-a', 'p-b', 'p-c'] },
        { label: 'Chai', amountMinor: 1000, participantIds: ['p-b'] }
      ],
      billAdjustments: [
        { adjustmentType: 'service_charge', label: 'Service charge', amountMinor: 900, allocationBasis: 'equal' },
        { adjustmentType: 'discount', label: 'Coupon discount', amountMinor: -300, allocationBasis: 'equal' }
      ]
    });

    expect(created.expense.shares).toEqual([
      { participantId: 'p-a', amountMinor: 3200, shareType: 'itemized', roundingDeltaMinor: 0 },
      { participantId: 'p-b', amountMinor: 4200, shareType: 'itemized', roundingDeltaMinor: 0 },
      { participantId: 'p-c', amountMinor: 3200, shareType: 'itemized', roundingDeltaMinor: 0 }
    ]);
    expect(created.expense.billAdjustments).toHaveLength(2);
    expect(app.services.balances.getGroupBalances('group-itemized').balances).toEqual([
      { groupId: 'group-itemized', participantId: 'p-a', currencyCode: 'INR', amountMinor: 7400 },
      { groupId: 'group-itemized', participantId: 'p-b', currencyCode: 'INR', amountMinor: -4200 },
      { groupId: 'group-itemized', participantId: 'p-c', currencyCode: 'INR', amountMinor: -3200 }
    ]);
    expect(() => app.services.balances.assertZeroSum('group-itemized')).not.toThrow();
  });
});
