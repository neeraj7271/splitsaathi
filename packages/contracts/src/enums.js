"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SplitTypes = exports.SettlementStates = exports.MembershipRoles = exports.GroupModes = void 0;
exports.GroupModes = ['flat', 'trip', 'couple', 'event', 'business', 'custom'];
exports.MembershipRoles = ['owner', 'admin', 'member', 'viewer'];
exports.SettlementStates = [
    'suggested',
    'intent_created',
    'intent_generated',
    'payer_opened_upi_app',
    'awaiting_payment_evidence',
    'proof_submitted',
    'auto_matched',
    'awaiting_receiver_confirmation',
    'confirmed',
    'ledger_posted',
    'expired',
    'cancelled',
    'disputed',
    'rejected',
    'partial_detected',
    'duplicate_reference_review',
    'reversed',
    'refunded'
];
exports.SplitTypes = ['equal', 'exact', 'percent', 'weight', 'itemized'];
//# sourceMappingURL=enums.js.map