"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GreedySettlementOptimizer = void 0;
class GreedySettlementOptimizer {
    suggest(balances) {
        const byCurrency = new Map();
        for (const balance of balances) {
            if (balance.amountMinor === 0)
                continue;
            byCurrency.set(balance.currencyCode, [...(byCurrency.get(balance.currencyCode) ?? []), balance]);
        }
        const suggestions = [];
        for (const [currencyCode, rows] of byCurrency.entries()) {
            const debtors = rows
                .filter((row) => row.amountMinor < 0)
                .map((row) => ({ ...row, amountMinor: Math.abs(row.amountMinor) }))
                .sort((left, right) => right.amountMinor - left.amountMinor);
            const creditors = rows
                .filter((row) => row.amountMinor > 0)
                .map((row) => ({ ...row }))
                .sort((left, right) => right.amountMinor - left.amountMinor);
            let debtorIndex = 0;
            let creditorIndex = 0;
            while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
                const debtor = debtors[debtorIndex];
                const creditor = creditors[creditorIndex];
                const amountMinor = Math.min(debtor.amountMinor, creditor.amountMinor);
                suggestions.push({
                    payerParticipantId: debtor.participantId,
                    payeeParticipantId: creditor.participantId,
                    amountMinor,
                    currencyCode,
                    explanation: `${debtor.participantId} pays ${creditor.participantId} because one owes the group and the other is owed.`
                });
                debtor.amountMinor -= amountMinor;
                creditor.amountMinor -= amountMinor;
                if (debtor.amountMinor === 0)
                    debtorIndex += 1;
                if (creditor.amountMinor === 0)
                    creditorIndex += 1;
            }
        }
        return suggestions;
    }
}
exports.GreedySettlementOptimizer = GreedySettlementOptimizer;
//# sourceMappingURL=settlement-optimizer.js.map