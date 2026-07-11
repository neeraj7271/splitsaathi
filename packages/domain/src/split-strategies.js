"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeightedShareSplitStrategy = exports.ExactAmountSplitStrategy = exports.EqualSplitStrategy = void 0;
const rounding_1 = require("./rounding");
class EqualSplitStrategy {
    allocator = new rounding_1.RoundingAllocator();
    calculate(totalMinor, participants) {
        return this.allocator
            .allocate(totalMinor, participants.map((participant) => ({
            id: participant.participantId,
            weightNumerator: 1,
            weightDenominator: 1
        })))
            .map((allocation) => ({
            participantId: allocation.id,
            amountMinor: allocation.amountMinor,
            roundingDeltaMinor: allocation.residualMinor
        }));
    }
}
exports.EqualSplitStrategy = EqualSplitStrategy;
class ExactAmountSplitStrategy {
    calculate(totalMinor, participants) {
        const rows = participants.map((participant) => ({
            participantId: participant.participantId,
            amountMinor: participant.amountMinor ?? 0,
            roundingDeltaMinor: 0
        }));
        const sum = rows.reduce((value, row) => value + row.amountMinor, 0);
        if (sum !== totalMinor) {
            throw new Error(`Exact split must sum to ${totalMinor}; received ${sum}.`);
        }
        return rows;
    }
}
exports.ExactAmountSplitStrategy = ExactAmountSplitStrategy;
class WeightedShareSplitStrategy {
    allocator = new rounding_1.RoundingAllocator();
    calculate(totalMinor, participants) {
        return this.allocator
            .allocate(totalMinor, participants.map((participant) => ({
            id: participant.participantId,
            weightNumerator: participant.weightNumerator ?? 1,
            weightDenominator: participant.weightDenominator ?? 1
        })))
            .map((allocation) => ({
            participantId: allocation.id,
            amountMinor: allocation.amountMinor,
            roundingDeltaMinor: allocation.residualMinor
        }));
    }
}
exports.WeightedShareSplitStrategy = WeightedShareSplitStrategy;
//# sourceMappingURL=split-strategies.js.map