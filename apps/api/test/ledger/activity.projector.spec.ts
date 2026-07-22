import type { DomainEvent } from '../../src/modules/ledger/ledger.types';
import { ActivityProjector } from '../../src/modules/ledger/activity.projector';

function event(partial: Partial<DomainEvent> & Pick<DomainEvent, 'type' | 'aggregateId' | 'eventId' | 'globalPosition'>): DomainEvent {
  return {
    aggregateType: 'expense',
    aggregateVersion: 1,
    occurredAt: '2026-07-10T09:00:00.000Z',
    payload: {},
    postings: [],
    metadata: {},
    ...partial
  };
}

describe('ActivityProjector', () => {
  it('defaults to ledger feed (expenses + posted payments) and omits raw participant uuids', () => {
    const projector = new ActivityProjector();
    const payerId = '11111111-1111-4111-8111-111111111111';
    const shareId = '22222222-2222-4222-8222-222222222222';

    projector.apply(
      event({
        eventId: 'e1',
        type: 'ExpenseCreated',
        aggregateId: 'expense-1',
        groupId: 'group-1',
        globalPosition: 1,
        payload: {
          expenseId: 'expense-1',
          description: 'Lunch',
          totalAmountMinor: 1000,
          currencyCode: 'INR',
          payers: [{ participantId: payerId, amountMinor: 1000 }],
          shares: [
            { participantId: payerId, shareType: 'equal' },
            { participantId: shareId, shareType: 'equal' }
          ]
        }
      })
    );
    projector.apply(
      event({
        eventId: 'e2',
        type: 'SettlementIntentCreated',
        aggregateType: 'settlement_intent',
        aggregateId: 'settlement-1',
        groupId: 'group-1',
        globalPosition: 2,
        payload: {
          settlementIntentId: 'settlement-1',
          payerParticipantId: payerId,
          payeeParticipantId: shareId,
          amountMinor: 500,
          currencyCode: 'INR',
          paymentMethod: 'upi'
        }
      })
    );
    projector.apply(
      event({
        eventId: 'e3',
        type: 'UpiAppOpened',
        aggregateType: 'settlement_intent',
        aggregateId: 'settlement-1',
        groupId: 'group-1',
        globalPosition: 3,
        payload: {
          settlementIntentId: 'settlement-1'
        }
      })
    );
    projector.apply(
      event({
        eventId: 'e4',
        type: 'SettlementLedgerPosted',
        aggregateType: 'settlement_intent',
        aggregateId: 'settlement-1',
        groupId: 'group-1',
        globalPosition: 4,
        payload: {
          settlementIntentId: 'settlement-1',
          payerParticipantId: payerId,
          payeeParticipantId: shareId,
          amountMinor: 500,
          currencyCode: 'INR'
        }
      })
    );

    const ledgerPage = projector.listGroupActivity('group-1', { limit: 10 });
    expect(ledgerPage.items.map((row) => row.type)).toEqual(['SettlementLedgerPosted', 'ExpenseCreated']);
    expect(ledgerPage.items[1].body).toContain('paid by members');
    expect(ledgerPage.items[1].body).toContain('split across members');
    expect(ledgerPage.items[1].body).not.toContain(payerId);

    const allPage = projector.listGroupActivity('group-1', { feed: 'all', limit: 10 });
    expect(allPage.items.map((row) => row.type)).toEqual([
      'SettlementLedgerPosted',
      'UpiAppOpened',
      'SettlementIntentCreated',
      'ExpenseCreated'
    ]);
    expect(allPage.items.find((row) => row.type === 'SettlementIntentCreated')?.body).toContain('Settlement update');
    expect(allPage.items.find((row) => row.type === 'SettlementIntentCreated')?.body).not.toContain(payerId);
  });
});
