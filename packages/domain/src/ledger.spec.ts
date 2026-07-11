import { BalancedPostingSet } from './ledger';

describe('BalancedPostingSet', () => {
  it('accepts zero-sum postings per currency', () => {
    expect(() =>
      BalancedPostingSet.create([
        {
          participantId: 'payer',
          currencyCode: 'INR',
          signedAmountMinor: 100,
          postingType: 'settlement_paid',
          sourceType: 'settlement',
          sourceId: 's1'
        },
        {
          participantId: 'payee',
          currencyCode: 'INR',
          signedAmountMinor: -100,
          postingType: 'settlement_received',
          sourceType: 'settlement',
          sourceId: 's1'
        }
      ])
    ).not.toThrow();
  });

  it('rejects unbalanced postings', () => {
    expect(() =>
      BalancedPostingSet.create([
        {
          participantId: 'payer',
          currencyCode: 'INR',
          signedAmountMinor: 100,
          postingType: 'bad',
          sourceType: 'test',
          sourceId: 'x'
        }
      ])
    ).toThrow(/balance to zero/);
  });
});
