import { GreedySettlementOptimizer } from './settlement-optimizer';

describe('GreedySettlementOptimizer', () => {
  it('settles debtors to creditors without changing net totals', () => {
    const suggestions = new GreedySettlementOptimizer().suggest([
      { participantId: 'a', amountMinor: -500, currencyCode: 'INR' },
      { participantId: 'b', amountMinor: 300, currencyCode: 'INR' },
      { participantId: 'c', amountMinor: 200, currencyCode: 'INR' }
    ]);

    expect(suggestions).toHaveLength(2);
    expect(suggestions.reduce((sum, row) => sum + row.amountMinor, 0)).toBe(500);
    expect(suggestions.every((row) => row.explanation.includes('to settle'))).toBe(true);
  });
});
