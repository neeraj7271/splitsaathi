"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettlementStateMachine = void 0;
const transitions = {
    suggested: { create_intent: 'intent_created' },
    intent_created: { generate_intent: 'intent_generated', cancel: 'cancelled', expire: 'expired' },
    intent_generated: {
        open_upi_app: 'payer_opened_upi_app',
        submit_proof: 'proof_submitted',
        cancel: 'cancelled',
        expire: 'expired'
    },
    payer_opened_upi_app: { submit_proof: 'proof_submitted', cancel: 'cancelled', expire: 'expired' },
    awaiting_payment_evidence: { submit_proof: 'proof_submitted', cancel: 'cancelled', expire: 'expired' },
    proof_submitted: {
        auto_match: 'auto_matched',
        request_confirmation: 'awaiting_receiver_confirmation',
        detect_partial: 'partial_detected',
        detect_duplicate: 'duplicate_reference_review',
        dispute: 'disputed',
        reject: 'rejected'
    },
    auto_matched: {
        request_confirmation: 'awaiting_receiver_confirmation',
        confirm: 'confirmed',
        detect_partial: 'partial_detected',
        detect_duplicate: 'duplicate_reference_review',
        dispute: 'disputed'
    },
    awaiting_receiver_confirmation: { confirm: 'confirmed', reject: 'rejected', dispute: 'disputed' },
    confirmed: { post_ledger: 'ledger_posted' },
    ledger_posted: { reverse: 'reversed', refund: 'refunded', dispute: 'disputed' },
    expired: {},
    cancelled: {},
    disputed: { reject: 'rejected', confirm: 'confirmed', reverse: 'reversed', refund: 'refunded' },
    rejected: {},
    partial_detected: { request_confirmation: 'awaiting_receiver_confirmation', reject: 'rejected', dispute: 'disputed' },
    duplicate_reference_review: { request_confirmation: 'awaiting_receiver_confirmation', reject: 'rejected', dispute: 'disputed' },
    reversed: {},
    refunded: {}
};
class SettlementStateMachine {
    transition(current, eventName) {
        const next = transitions[current][eventName];
        if (!next) {
            throw new Error(`Invalid settlement transition: ${current} -> ${eventName}`);
        }
        return next;
    }
    can(current, eventName) {
        return Boolean(transitions[current][eventName]);
    }
}
exports.SettlementStateMachine = SettlementStateMachine;
//# sourceMappingURL=settlement-state-machine.js.map