import { buildSettlementExplanation, GreedySettlementOptimizer } from './settlement-optimizer';

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

  it('buildSettlementExplanation omits participant ids from copy', () => {
    const explanation = buildSettlementExplanation('payer-uuid-1', 'payee-uuid-2', [
      { description: 'Dinner', participantIds: ['payer-uuid-1', 'payee-uuid-2'] }
    ]);

    expect(explanation).toBe('Someone owes this amount to settle Dinner.');
    expect(explanation).not.toContain('payer-uuid-1');
    expect(explanation).not.toContain('payee-uuid-2');
  });
});
