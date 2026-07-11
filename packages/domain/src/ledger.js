"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BalancedPostingSet = void 0;
class BalancedPostingSet {
    postings;
    constructor(postings) {
        this.postings = postings;
    }
    static create(postings) {
        const totals = new Map();
        for (const posting of postings) {
            if (!Number.isInteger(posting.signedAmountMinor)) {
                throw new Error('Ledger posting amounts must use integer minor units.');
            }
            totals.set(posting.currencyCode, (totals.get(posting.currencyCode) ?? 0) + posting.signedAmountMinor);
        }
        for (const [currencyCode, total] of totals.entries()) {
            if (total !== 0) {
                throw new Error(`Ledger postings must balance to zero for ${currencyCode}; got ${total}.`);
            }
        }
        return new BalancedPostingSet(postings);
    }
}
exports.BalancedPostingSet = BalancedPostingSet;
//# sourceMappingURL=ledger.js.map