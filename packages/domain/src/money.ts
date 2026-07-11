export class Money {
  private constructor(
    public readonly amountMinor: number,
    public readonly currencyCode: string
  ) {
    if (!Number.isInteger(amountMinor)) {
      throw new Error('Money amount must be stored in integer minor units.');
    }
    if (!/^[A-Z]{3}$/.test(currencyCode)) {
      throw new Error('Currency must be a three-letter ISO code.');
    }
  }

  static of(amountMinor: number, currencyCode = 'INR'): Money {
    return new Money(amountMinor, currencyCode);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.amountMinor + other.amountMinor, this.currencyCode);
  }

  negate(): Money {
    return Money.of(-this.amountMinor, this.currencyCode);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currencyCode !== other.currencyCode) {
      throw new Error(`Currency mismatch: ${this.currencyCode} vs ${other.currencyCode}`);
    }
  }
}

export function formatDecimalAmount(amountMinor: number, minorUnit = 2): string {
  const sign = amountMinor < 0 ? '-' : '';
  const absolute = Math.abs(amountMinor);
  const divisor = 10 ** minorUnit;
  const major = Math.floor(absolute / divisor);
  const minor = String(absolute % divisor).padStart(minorUnit, '0');
  return `${sign}${major}.${minor}`;
}
