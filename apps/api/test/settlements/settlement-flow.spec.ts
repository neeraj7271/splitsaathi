import { createFinancialTestApp } from '../support/financial-test-app';

async function seedDebt(app: ReturnType<typeof createFinancialTestApp>) {
  await app.services.expenses.createExpense({
    idempotencyKey: 'expense-create-settlement',
    actorId: 'user-a',
    groupId: 'group-1',
    expenseId: 'expense-settlement',
    description: 'Groceries',
    expenseDate: '2026-07-10',
    currencyCode: 'INR',
    payers: [{ participantId: 'p-a', amountMinor: 10000 }],
    shares: [
      { participantId: 'p-a', shareType: 'equal' },
      { participantId: 'p-b', shareType: 'equal' }
    ]
  });
}

describe('settlement lifecycle', () => {
  it('suggests, creates UPI intent, accepts proof, confirms, and posts ledger settlement', async () => {
    const app = createFinancialTestApp();
    await seedDebt(app);

    const [suggestion] = app.services.settlementSuggestions.suggestForGroup('group-1');
    expect(suggestion).toMatchObject({
      payerParticipantId: 'p-b',
      payeeParticipantId: 'p-a',
      amountMinor: 5000,
      currencyCode: 'INR'
    });

    const created = await app.services.settlements.createIntent({
      idempotencyKey: 'settlement-create-1',
      actorId: 'user-b',
      groupId: 'group-1',
      settlementIntentId: 'settlement-1',
      payerParticipantId: 'p-b',
      payeeParticipantId: 'p-a',
      amountMinor: 5000,
      currencyCode: 'INR',
      payeeVpa: 'alice@upi',
      payeeName: 'Alice'
    });
    expect(created.intent.state).toBe('intent_generated');
    expect(created.intent.upiUri).toContain('upi://pay');

    const opened = await app.services.settlements.markUpiOpened({
      idempotencyKey: 'settlement-open-1',
      actorId: 'user-b',
      settlementIntentId: 'settlement-1',
      upiApp: 'gpay',
      expectedVersion: 2
    });
    expect(opened.intent.state).toBe('payer_opened_upi_app');

    const proof = await app.services.settlements.submitProof({
      idempotencyKey: 'settlement-proof-1',
      actorId: 'user-b',
      settlementIntentId: 'settlement-1',
      amountMinor: 5000,
      utr: 'UTR123',
      expectedVersion: 3
    });
    expect(proof.intent.state).toBe('awaiting_receiver_confirmation');

    const confirmed = await app.services.settlements.confirm({
      idempotencyKey: 'settlement-confirm-1',
      actorId: 'user-a',
      settlementIntentId: 'settlement-1',
      expectedVersion: 5
    });
    expect(confirmed.intent.state).toBe('ledger_posted');
    expect(app.services.balances.getGroupBalances('group-1').balances.every((row) => row.amountMinor === 0)).toBe(true);
  });

  it('detects duplicate UTR and partial proof exception states', async () => {
    const app = createFinancialTestApp();
    await seedDebt(app);

    await app.services.settlements.createIntent({
      idempotencyKey: 'settlement-create-a',
      actorId: 'user-b',
      groupId: 'group-1',
      settlementIntentId: 'settlement-a',
      payerParticipantId: 'p-b',
      payeeParticipantId: 'p-a',
      amountMinor: 5000,
      currencyCode: 'INR',
      payeeVpa: 'alice@upi',
      payeeName: 'Alice'
    });
    await app.services.settlements.submitProof({
      idempotencyKey: 'settlement-proof-a',
      actorId: 'user-b',
      settlementIntentId: 'settlement-a',
      amountMinor: 5000,
      utr: 'DUPLICATE-UTR',
      expectedVersion: 2
    });

    await app.services.settlements.createIntent({
      idempotencyKey: 'settlement-create-b',
      actorId: 'user-b',
      groupId: 'group-1',
      settlementIntentId: 'settlement-b',
      payerParticipantId: 'p-b',
      payeeParticipantId: 'p-a',
      amountMinor: 5000,
      currencyCode: 'INR',
      payeeVpa: 'alice@upi',
      payeeName: 'Alice'
    });
    const duplicate = await app.services.settlements.submitProof({
      idempotencyKey: 'settlement-proof-b',
      actorId: 'user-b',
      settlementIntentId: 'settlement-b',
      amountMinor: 5000,
      utr: 'DUPLICATE-UTR',
      expectedVersion: 2
    });
    expect(duplicate.intent.state).toBe('duplicate_reference_review');

    await app.services.settlements.createIntent({
      idempotencyKey: 'settlement-create-c',
      actorId: 'user-b',
      groupId: 'group-1',
      settlementIntentId: 'settlement-c',
      payerParticipantId: 'p-b',
      payeeParticipantId: 'p-a',
      amountMinor: 5000,
      currencyCode: 'INR',
      payeeVpa: 'alice@upi',
      payeeName: 'Alice'
    });
    const partial = await app.services.settlements.submitProof({
      idempotencyKey: 'settlement-proof-c',
      actorId: 'user-b',
      settlementIntentId: 'settlement-c',
      amountMinor: 4000,
      utr: 'PARTIAL-UTR',
      expectedVersion: 2
    });
    expect(partial.intent.state).toBe('partial_detected');
    const disputed = await app.services.settlements.dispute({
      idempotencyKey: 'settlement-dispute-c',
      actorId: 'user-a',
      settlementIntentId: 'settlement-c',
      expectedVersion: 4,
      reason: 'Amount does not match'
    });
    expect(disputed.intent.state).toBe('disputed');
  });

  it('records a successful gateway callback as provider proof and auto-match without ledger posting', async () => {
    const app = createFinancialTestApp();
    await seedDebt(app);

    await app.services.settlements.createIntent({
      idempotencyKey: 'settlement-gateway-create',
      actorId: 'user-b',
      groupId: 'group-1',
      settlementIntentId: 'settlement-gateway',
      payerParticipantId: 'p-b',
      payeeParticipantId: 'p-a',
      amountMinor: 5000,
      currencyCode: 'INR',
      payeeVpa: 'alice@upi',
      payeeName: 'Alice'
    });

    const matched = await app.services.settlements.recordGatewayPayment({
      idempotencyKey: 'gateway-callback-1',
      actorId: 'payment-gateway:razorpay',
      status: {
        providerReference: 'SS-SETTLEMENTGATEWAY',
        settlementIntentId: 'settlement-gateway',
        status: 'succeeded',
        amountMinor: 5000,
        currencyCode: 'INR',
        utr: 'GATEWAY-UTR-1'
      }
    });

    expect(matched.intent.state).toBe('auto_matched');
    expect(matched.intent.proofs[0]).toMatchObject({ utr: 'GATEWAY-UTR-1', amountMinor: 5000 });
    expect(app.services.balances.getGroupBalances('group-1').balances).toEqual([
      { groupId: 'group-1', participantId: 'p-a', currencyCode: 'INR', amountMinor: 5000 },
      { groupId: 'group-1', participantId: 'p-b', currencyCode: 'INR', amountMinor: -5000 }
    ]);

    const replayed = await app.services.settlements.recordGatewayPayment({
      idempotencyKey: 'gateway-callback-1',
      actorId: 'payment-gateway:razorpay',
      status: {
        providerReference: 'SS-SETTLEMENTGATEWAY',
        settlementIntentId: 'settlement-gateway',
        status: 'succeeded',
        amountMinor: 5000,
        currencyCode: 'INR',
        utr: 'GATEWAY-UTR-1'
      }
    });
    expect(replayed.events.map((event) => event.eventId)).toEqual(matched.events.map((event) => event.eventId));
    expect((await app.ledger.replay({ aggregateType: 'settlement_intent', aggregateId: 'settlement-gateway' }))).toHaveLength(4);

    await app.services.settlements.createIntent({
      idempotencyKey: 'settlement-gateway-create-duplicate-reference',
      actorId: 'user-b',
      groupId: 'group-1',
      settlementIntentId: 'settlement-gateway-duplicate-reference',
      payerParticipantId: 'p-b',
      payeeParticipantId: 'p-a',
      amountMinor: 5000,
      currencyCode: 'INR',
      payeeVpa: 'alice@upi',
      payeeName: 'Alice'
    });
    const duplicateReference = await app.services.settlements.recordGatewayPayment({
      idempotencyKey: 'gateway-callback-duplicate-reference',
      actorId: 'payment-gateway:razorpay',
      status: {
        providerReference: 'SS-DUPLICATE',
        settlementIntentId: 'settlement-gateway-duplicate-reference',
        status: 'succeeded',
        amountMinor: 5000,
        currencyCode: 'INR',
        utr: 'GATEWAY-UTR-1'
      }
    });
    expect(duplicateReference.intent.state).toBe('duplicate_reference_review');
  });

  it('rejects invalid settlement transitions before appending events or postings', async () => {
    const app = createFinancialTestApp();
    await seedDebt(app);

    await app.services.settlements.createIntent({
      idempotencyKey: 'settlement-invalid-create',
      actorId: 'user-b',
      groupId: 'group-1',
      settlementIntentId: 'settlement-invalid',
      payerParticipantId: 'p-b',
      payeeParticipantId: 'p-a',
      amountMinor: 5000,
      currencyCode: 'INR',
      payeeVpa: 'alice@upi',
      payeeName: 'Alice'
    });

    await expect(
      app.services.settlements.confirm({
        idempotencyKey: 'settlement-invalid-confirm',
        actorId: 'user-a',
        settlementIntentId: 'settlement-invalid',
        expectedVersion: 2
      })
    ).rejects.toThrow('Invalid settlement transition');

    await expect(
      app.services.settlements.reverse({
        idempotencyKey: 'settlement-invalid-reverse',
        actorId: 'user-a',
        settlementIntentId: 'settlement-invalid',
        expectedVersion: 2,
        reason: 'Cannot reverse before ledger posting'
      })
    ).rejects.toThrow('Invalid settlement transition');

    await expect(app.ledger.getVersion('settlement_intent', 'settlement-invalid')).resolves.toBe(2);
    await expect(app.ledger.replay({ aggregateType: 'settlement_intent', aggregateId: 'settlement-invalid' })).resolves.toHaveLength(2);
    expect(app.projectors.settlements.getIntent('settlement-invalid')?.state).toBe('intent_generated');
    expect(app.services.balances.getGroupBalances('group-1').balances).toEqual([
      { groupId: 'group-1', participantId: 'p-a', currencyCode: 'INR', amountMinor: 5000 },
      { groupId: 'group-1', participantId: 'p-b', currencyCode: 'INR', amountMinor: -5000 }
    ]);
  });
});
