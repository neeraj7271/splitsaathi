"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatInr = formatInr;
function formatInr(amountMinor) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amountMinor / 100);
}
//# sourceMappingURL=money.js.map