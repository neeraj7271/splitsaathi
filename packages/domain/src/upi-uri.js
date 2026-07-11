"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpiUriBuilder = void 0;
const money_1 = require("./money");
class UpiUriBuilder {
    build(input) {
        if ((input.currencyCode ?? 'INR') !== 'INR') {
            throw new Error('UPI MVP supports INR intents only.');
        }
        const params = new URLSearchParams({
            pa: input.payeeVpa,
            pn: input.payeeName,
            am: (0, money_1.formatDecimalAmount)(input.amountMinor),
            cu: 'INR',
            tn: input.note,
            tr: input.transactionReference
        });
        return `upi://pay?${params.toString()}`;
    }
}
exports.UpiUriBuilder = UpiUriBuilder;
//# sourceMappingURL=upi-uri.js.map