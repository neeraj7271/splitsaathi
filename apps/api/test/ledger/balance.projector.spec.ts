import { BalanceProjector } from '../../src/modules/ledger/balance.projector';
import type { DomainEvent } from '../../src/modules/ledger/ledger.types';

function postingEvent(
  groupId: string,
  postings: Array<{ participantId: string; currencyCode: string; signedAmountMinor: number }>
): DomainEvent {
  return {
    eventId: `evt-${Math.random()}`,
    type: 'expense.created',
    groupId,
    aggregateId: groupId,
    aggregateType: 'group',
    aggregateVersion: 1,
    occurredAt: new Date().toISOString(),
    actorId: 'test',
    payload: {},
    postings
  } as unknown as DomainEvent;
}

describe('BalanceProjector.listGroupBalances', () => {
  it('includes zero balances by default so UI can show Settled', () => {
    const projector = new BalanceProjector();
    projector.apply(
      postingEvent('g1', [
        { participantId: 'a', currencyCode: 'INR', signedAmountMinor: 100 },
        { participantId: 'b', currencyCode: 'INR', signedAmountMinor: -100 }
      ])
    );
    projector.apply(
      postingEvent('g1', [
        { participantId: 'a', currencyCode: 'INR', signedAmountMinor: -100 },
        { participantId: 'b', currencyCode: 'INR', signedAmountMinor: 100 }
      ])
    );

    const withZeros = projector.listGroupBalances('g1');
    expect(withZeros).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ participantId: 'a', amountMinor: 0 }),
        expect.objectContaining({ participantId: 'b', amountMinor: 0 })
      ])
    );

    expect(projector.listGroupBalances('g1', { includeZero: false })).toEqual([]);
  });
});
