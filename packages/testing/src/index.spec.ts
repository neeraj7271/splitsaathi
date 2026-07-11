import { assertBalancedByCurrency, equalSplitExpense, ledgerPostingsTotalByCurrency, testGroup } from './index';

describe('@splitsaathi/testing fixtures', () => {
  it('creates deterministic group and equal-split expense fixtures', () => {
    const group = testGroup(3);
    expect(group.participants.map((participant) => participant.id)).toEqual([
      'participant-1',
      'participant-2',
      'participant-3'
    ]);

    const expense = equalSplitExpense({ groupId: group.id });
    expect(expense).toMatchObject({
      groupId: 'group-test-1',
      currencyCode: 'INR',
      payers: [{ participantId: 'participant-1', amountMinor: 10000 }]
    });
    expect(expense.shares).toHaveLength(2);
  });

  it('asserts balanced ledger fixtures and exposes currency totals for debugging', () => {
    const postings = [
      {
        participantId: 'participant-1',
        currencyCode: 'INR',
        signedAmountMinor: 5000,
        postingType: 'expense_payment',
        sourceType: 'expense',
        sourceId: 'expense-test-1'
      },
      {
        participantId: 'participant-2',
        currencyCode: 'INR',
        signedAmountMinor: -5000,
        postingType: 'expense_share',
        sourceType: 'expense',
        sourceId: 'expense-test-1'
      }
    ];

    expect(() => assertBalancedByCurrency(postings)).not.toThrow();
    expect(ledgerPostingsTotalByCurrency(postings).get('INR')).toBe(0);
  });
});
