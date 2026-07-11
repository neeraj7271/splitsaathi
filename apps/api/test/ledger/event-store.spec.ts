import { IdempotencyConflictError, InMemoryEventStore, OptimisticConcurrencyError } from '../../src/modules/ledger';

describe('InMemoryEventStore', () => {
  it('appends, replays, enforces optimistic concurrency, and deduplicates idempotency keys', () => {
    const store = new InMemoryEventStore();
    const first = store.append({
      aggregateType: 'expense',
      aggregateId: 'expense-1',
      expectedVersion: 0,
      idempotencyKey: 'idem-1',
      idempotencyPayload: { command: 'create', amount: 100 },
      events: [
        {
          type: 'ExpenseCreated',
          aggregateType: 'expense',
          aggregateId: 'expense-1',
          groupId: 'group-1',
          payload: { expenseId: 'expense-1' },
          postings: [
            {
              participantId: 'p-a',
              currencyCode: 'INR',
              signedAmountMinor: 100,
              postingType: 'test_credit',
              sourceType: 'test',
              sourceId: 'expense-1'
            },
            {
              participantId: 'p-b',
              currencyCode: 'INR',
              signedAmountMinor: -100,
              postingType: 'test_debit',
              sourceType: 'test',
              sourceId: 'expense-1'
            }
          ]
        }
      ]
    });

    const replayed = store.append({
      aggregateType: 'expense',
      aggregateId: 'expense-1',
      expectedVersion: 0,
      idempotencyKey: 'idem-1',
      idempotencyPayload: { amount: 100, command: 'create' },
      events: [
        {
          type: 'ExpenseCreated',
          aggregateType: 'expense',
          aggregateId: 'expense-1',
          groupId: 'group-1',
          payload: { ignored: true }
        }
      ]
    });

    expect(replayed[0].eventId).toBe(first[0].eventId);
    expect(store.replay()).toHaveLength(1);
    expect(store.getVersion('expense', 'expense-1')).toBe(1);
    expect(() =>
      store.append({
        aggregateType: 'expense',
        aggregateId: 'expense-1',
        expectedVersion: 0,
        events: [
          {
            type: 'ExpenseAdjusted',
            aggregateType: 'expense',
            aggregateId: 'expense-1',
            payload: {}
          }
        ]
      })
    ).toThrow(OptimisticConcurrencyError);
    expect(() =>
      store.append({
        aggregateType: 'expense',
        aggregateId: 'expense-1',
        expectedVersion: 'any',
        idempotencyKey: 'idem-1',
        idempotencyPayload: { command: 'create', amount: 101 },
        events: [
          {
            type: 'ExpenseAdjusted',
            aggregateType: 'expense',
            aggregateId: 'expense-1',
            payload: {}
          }
        ]
      })
    ).toThrow(IdempotencyConflictError);

    expect(
      store.append({
        aggregateType: 'expense',
        aggregateId: 'expense-2',
        expectedVersion: 0,
        idempotencyKey: 'idem-1',
        idempotencyPayload: { command: 'create', amount: 101 },
        events: [
          {
            type: 'ExpenseCreated',
            aggregateType: 'expense',
            aggregateId: 'expense-2',
            groupId: 'group-1',
            actorId: 'user-b',
            payload: { expenseId: 'expense-2' },
            postings: [
              {
                participantId: 'p-a',
                currencyCode: 'INR',
                signedAmountMinor: 101,
                postingType: 'test_credit',
                sourceType: 'test',
                sourceId: 'expense-2'
              },
              {
                participantId: 'p-b',
                currencyCode: 'INR',
                signedAmountMinor: -101,
                postingType: 'test_debit',
                sourceType: 'test',
                sourceId: 'expense-2'
              }
            ]
          }
        ]
      })
    ).toHaveLength(1);

    expect(
      store.append({
        aggregateType: 'settlement_intent',
        aggregateId: 'settlement-1',
        expectedVersion: 0,
        idempotencyKey: 'idem-1',
        idempotencyPayload: { command: 'create_settlement' },
        events: [
          {
            type: 'SettlementIntentCreated',
            aggregateType: 'settlement_intent',
            aggregateId: 'settlement-1',
            groupId: 'group-1',
            payload: { settlementIntentId: 'settlement-1' }
          }
        ]
      })
    ).toHaveLength(1);
  });

  it('rejects postings that do not sum to zero per currency', () => {
    const store = new InMemoryEventStore();
    expect(() =>
      store.append({
        aggregateType: 'expense',
        aggregateId: 'expense-1',
        expectedVersion: 0,
        events: [
          {
            type: 'ExpenseCreated',
            aggregateType: 'expense',
            aggregateId: 'expense-1',
            groupId: 'group-1',
            payload: {},
            postings: [
              {
                participantId: 'p-a',
                currencyCode: 'INR',
                signedAmountMinor: 100,
                postingType: 'bad',
                sourceType: 'test',
                sourceId: 'expense-1'
              }
            ]
          }
        ]
      })
    ).toThrow(/balance to zero/);
  });
});
