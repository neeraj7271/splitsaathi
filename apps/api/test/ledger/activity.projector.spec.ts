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
  it('paginates activity and omits raw participant uuids from body copy', () => {
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

    const page = projector.listGroupActivity('group-1', { limit: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBe(2);
    expect(page.items[0].type).toBe('SettlementIntentCreated');
    expect(page.items[0].body).toContain('Settlement update');
    expect(page.items[0].body).not.toContain(payerId);
    expect(page.items[0].context).toEqual(
      expect.objectContaining({
        payerParticipantId: payerId,
        payeeParticipantId: shareId
      })
    );

    const expensePage = projector.listGroupActivity('group-1', { limit: 10, cursor: 2 });
    expect(expensePage.items[0].body).toContain('paid by members');
    expect(expensePage.items[0].body).toContain('split across members');
    expect(expensePage.items[0].body).not.toContain(payerId);
  });
});
