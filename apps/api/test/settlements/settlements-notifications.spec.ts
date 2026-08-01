import { SettlementsController } from '../../src/modules/settlements/settlements.controller';
import type { SettlementIntentRow } from '../../src/modules/settlements/settlement.types';

describe('SettlementsController cash notifications', () => {
  const cashIntent: SettlementIntentRow = {
    settlementIntentId: 'intent-cash-1',
    groupId: 'group-1',
    payerParticipantId: 'payer-p',
    payeeParticipantId: 'payee-p',
    amountMinor: 5000,
    currencyCode: 'INR',
    note: 'Cash settlement',
    paymentMethod: 'cash',
    state: 'awaiting_receiver_confirmation',
    createdBy: 'user-payer',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    proofs: [],
    appOpenEvents: [],
    timeline: []
  };

  function buildController() {
    const notifications = { create: jest.fn(async (input: unknown) => input) };
    const groups = {
      resolveUserIdForParticipant: jest.fn(async (_groupId: string, participantId: string) => {
        if (participantId === 'payee-p') {
          return 'user-payee';
        }
        if (participantId === 'payer-p') {
          return 'user-payer';
        }
        return null;
      }),
      getGroupName: jest.fn(async () => 'Weekend trip'),
      isGroupAdminOrOwner: jest.fn(async () => false)
    };
    const commands = {
      createIntent: jest.fn(async () => ({ intent: cashIntent, events: [] }))
    };
    const authorization = {
      assertCan: jest.fn(async () => undefined)
    };
    const settlements = {
      getIntent: jest.fn()
    };
    const suggestions = {
      suggestForGroup: jest.fn()
    };

    const controller = new SettlementsController(
      commands as any,
      settlements as any,
      suggestions as any,
      authorization as any,
      notifications as any,
      groups as any
    );

    return { controller, notifications, commands, groups };
  }

  it('requests payee confirmation when a cash settlement intent is created', async () => {
    const { controller, notifications, commands } = buildController();

    await controller.createIntent(
      { userId: 'user-payer' } as any,
      'idem-cash-1',
      {
        groupId: 'group-1',
        payerParticipantId: 'payer-p',
        payeeParticipantId: 'payee-p',
        amountMinor: 5000,
        currencyCode: 'INR',
        paymentMethod: 'cash',
        payeeName: 'Alice'
      }
    );

    expect(commands.createIntent).toHaveBeenCalled();
    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-payee',
        type: 'settlement_confirmation_requested',
        title: 'Confirm cash payment'
      })
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-payer',
        type: 'settlement_awaiting_confirmation',
        title: 'Waiting for confirmation'
      })
    );
  });
});
