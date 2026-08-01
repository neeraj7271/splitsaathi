import type { DomainEvent } from '../../src/modules/ledger';
import { SettlementProjector } from '../../src/modules/settlements/settlement.projector';

function legacyEvent(
  partial: Pick<DomainEvent, 'eventId' | 'type' | 'payload'> & Partial<DomainEvent>
): DomainEvent {
  return {
    aggregateType: 'settlement_intent',
    aggregateId: 'legacy-cash',
    groupId: 'group-1',
    actorId: 'user-b',
    occurredAt: '2026-08-01T12:00:00.000Z',
    aggregateVersion: 1,
    globalPosition: 1,
    postings: [],
    metadata: {},
    ...partial
  };
}

describe('SettlementProjector legacy replay', () => {
  it('replays immediate cash ledger postings without SettlementConfirmed', () => {
    const projector = new SettlementProjector();
    const settlementIntentId = 'legacy-cash';

    projector.apply(
      legacyEvent({
        eventId: 'evt-1',
        aggregateVersion: 1,
        globalPosition: 1,
        type: 'SettlementIntentCreated',
        payload: {
          settlementIntentId,
          groupId: 'group-1',
          payerParticipantId: 'p-b',
          payeeParticipantId: 'p-a',
          amountMinor: 5000,
          currencyCode: 'INR',
          note: 'legacy',
          paymentMethod: 'cash'
        }
      })
    );
    projector.apply(
      legacyEvent({
        eventId: 'evt-2',
        aggregateVersion: 2,
        globalPosition: 2,
        type: 'CashSettlementRecorded',
        payload: { settlementIntentId, reason: 'Marked as paid in cash' }
      })
    );
    projector.apply(
      legacyEvent({
        eventId: 'evt-3',
        aggregateVersion: 3,
        globalPosition: 3,
        type: 'SettlementLedgerPosted',
        payload: { settlementIntentId }
      })
    );

    expect(projector.getIntent(settlementIntentId)?.state).toBe('ledger_posted');
  });
});
