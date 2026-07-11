import { createFinancialTestApp } from '../support/financial-test-app';

describe('recurring expenses', () => {
  it('creates a monthly schedule and generates a due expense occurrence', async () => {
    const app = createFinancialTestApp();
    const schedule = await app.services.recurring.createSchedule({
      idempotencyKey: 'recurring-create-1',
      actorId: 'user-a',
      groupId: 'group-1',
      recurringScheduleId: 'schedule-1',
      cadence: 'monthly',
      startDate: '2026-07-01',
      template: {
        description: 'Rent',
        category: 'Home',
        currencyCode: 'INR',
        payers: [{ participantId: 'p-a', amountMinor: 3000000 }],
        shares: [
          { participantId: 'p-a', shareType: 'equal' },
          { participantId: 'p-b', shareType: 'equal' }
        ]
      }
    });

    expect(schedule.schedule.nextRunDate).toBe('2026-07-01');
    const generated = await app.services.recurring.generateDue({
      idempotencyKey: 'recurring-generate-1',
      actorId: 'user-a',
      asOfDate: '2026-07-10'
    });

    expect(generated.generated).toHaveLength(1);
    expect(app.projectors.recurring.getSchedule('schedule-1')?.nextRunDate).toBe('2026-08-01');
    expect(app.projectors.expenses.listGroupExpenses('group-1')[0].description).toBe('Rent');
    expect(app.services.balances.getGroupBalances('group-1').balances).toEqual([
      { groupId: 'group-1', participantId: 'p-a', currencyCode: 'INR', amountMinor: 1500000 },
      { groupId: 'group-1', participantId: 'p-b', currencyCode: 'INR', amountMinor: -1500000 }
    ]);
  });
});
