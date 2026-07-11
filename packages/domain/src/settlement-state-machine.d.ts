import type { SettlementState } from '@splitsaathi/contracts';
export type SettlementEventName = 'create_intent' | 'generate_intent' | 'open_upi_app' | 'submit_proof' | 'auto_match' | 'request_confirmation' | 'confirm' | 'post_ledger' | 'expire' | 'cancel' | 'reject' | 'detect_partial' | 'detect_duplicate' | 'dispute' | 'reverse' | 'refund';
export declare class SettlementStateMachine {
    transition(current: SettlementState, eventName: SettlementEventName): SettlementState;
    can(current: SettlementState, eventName: SettlementEventName): boolean;
}
