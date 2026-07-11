import { SettlementStateMachine, type SettlementEventName } from './settlement-state-machine';

describe('SettlementStateMachine', () => {
  const allEvents: SettlementEventName[] = [
    'create_intent',
    'generate_intent',
    'open_upi_app',
    'submit_proof',
    'auto_match',
    'request_confirmation',
    'confirm',
    'post_ledger',
    'expire',
    'cancel',
    'reject',
    'detect_partial',
    'detect_duplicate',
    'dispute',
    'reverse',
    'refund'
  ];

  it('walks the happy path to ledger_posted', () => {
    const machine = new SettlementStateMachine();
    let state = machine.transition('suggested', 'create_intent');
    state = machine.transition(state, 'generate_intent');
    state = machine.transition(state, 'open_upi_app');
    state = machine.transition(state, 'submit_proof');
    state = machine.transition(state, 'request_confirmation');
    state = machine.transition(state, 'confirm');
    state = machine.transition(state, 'post_ledger');

    expect(state).toBe('ledger_posted');
  });

  it.each<SettlementEventName>(['expire', 'cancel', 'detect_partial', 'detect_duplicate', 'dispute', 'reverse', 'refund'])(
    'supports exception transition %s somewhere in the lifecycle',
    (eventName) => {
      const machine = new SettlementStateMachine();
      const states = [
        'intent_created',
        'intent_generated',
        'proof_submitted',
        'auto_matched',
        'awaiting_receiver_confirmation',
        'ledger_posted'
      ] as const;
      expect(states.some((state) => machine.can(state, eventName))).toBe(true);
    }
  );

  it('rejects invalid transitions', () => {
    expect(() => new SettlementStateMachine().transition('suggested', 'post_ledger')).toThrow(/Invalid settlement/);
  });

  it.each([
    ['suggested', 'create_intent', 'intent_created'],
    ['intent_created', 'generate_intent', 'intent_generated'],
    ['intent_created', 'cancel', 'cancelled'],
    ['intent_generated', 'open_upi_app', 'payer_opened_upi_app'],
    ['intent_generated', 'submit_proof', 'proof_submitted'],
    ['payer_opened_upi_app', 'submit_proof', 'proof_submitted'],
    ['proof_submitted', 'request_confirmation', 'awaiting_receiver_confirmation'],
    ['proof_submitted', 'detect_partial', 'partial_detected'],
    ['proof_submitted', 'detect_duplicate', 'duplicate_reference_review'],
    ['auto_matched', 'confirm', 'confirmed'],
    ['awaiting_receiver_confirmation', 'confirm', 'confirmed'],
    ['awaiting_receiver_confirmation', 'reject', 'rejected'],
    ['confirmed', 'post_ledger', 'ledger_posted'],
    ['ledger_posted', 'reverse', 'reversed'],
    ['ledger_posted', 'refund', 'refunded'],
    ['ledger_posted', 'dispute', 'disputed'],
    ['partial_detected', 'request_confirmation', 'awaiting_receiver_confirmation'],
    ['duplicate_reference_review', 'request_confirmation', 'awaiting_receiver_confirmation'],
    ['disputed', 'reject', 'rejected'],
    ['disputed', 'confirm', 'confirmed'],
    ['disputed', 'reverse', 'reversed'],
    ['disputed', 'refund', 'refunded']
  ] as const)('allows %s -> %s -> %s', (from, eventName, to) => {
    const machine = new SettlementStateMachine();
    expect(machine.can(from, eventName)).toBe(true);
    expect(machine.transition(from, eventName)).toBe(to);
  });

  it.each(['expired', 'cancelled', 'rejected', 'reversed', 'refunded'] as const)(
    'keeps terminal state %s immutable',
    (state) => {
      const machine = new SettlementStateMachine();
      for (const eventName of allEvents) {
        expect(machine.can(state, eventName)).toBe(false);
        expect(() => machine.transition(state, eventName)).toThrow(/Invalid settlement/);
      }
    }
  );
});
