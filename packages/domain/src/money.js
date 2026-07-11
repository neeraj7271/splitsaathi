"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Money = void 0;
exports.formatDecimalAmount = formatDecimalAmount;
class Money {
    amountMinor;
    currencyCode;
    constructor(amountMinor, currencyCode) {
        this.amountMinor = amountMinor;
        this.currencyCode = currencyCode;
        if (!Number.isInteger(amountMinor)) {
            throw new Error('Money amount must be stored in integer minor units.');
        }
        if (!/^[A-Z]{3}$/.test(currencyCode)) {
            throw new Error('Currency must be a three-letter ISO code.');
        }
    }
    static of(amountMinor, currencyCode = 'INR') {
        return new Money(amountMinor, currencyCode);
    }
    add(other) {
        this.assertSameCurrency(other);
        return Money.of(this.amountMinor + other.amountMinor, this.currencyCode);
    }
    negate() {
        return Money.of(-this.amountMinor, this.currencyCode);
    }
    assertSameCurrency(other) {
        if (this.currencyCode !== other.currencyCode) {
            throw new Error(`Currency mismatch: ${this.currencyCode} vs ${other.currencyCode}`);
        }
    }
}
exports.Money = Money;
function formatDecimalAmount(amountMinor, minorUnit = 2) {
    const sign = amountMinor < 0 ? '-' : '';
    const absolute = Math.abs(amountMinor);
    const divisor = 10 ** minorUnit;
    const major = Math.floor(absolute / divisor);
    const minor = String(absolute % divisor).padStart(minorUnit, '0');
    return `${sign}${major}.${minor}`;
}
//# sourceMappingURL=money.js.map