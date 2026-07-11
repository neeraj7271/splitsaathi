import { formatDecimalAmount } from './money';

export interface UpiUriInput {
  payeeVpa: string;
  payeeName: string;
  amountMinor: number;
  currencyCode?: string;
  note: string;
  transactionReference: string;
}

export class UpiUriBuilder {
  build(input: UpiUriInput): string {
    if ((input.currencyCode ?? 'INR') !== 'INR') {
      throw new Error('UPI MVP supports INR intents only.');
    }
    if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw new Error('UPI amount must be a positive integer minor-unit value.');
    }
    if (!isValidVpa(input.payeeVpa)) {
      throw new Error('UPI payee VPA is invalid.');
    }
    const params = new URLSearchParams({
      pa: input.payeeVpa,
      pn: input.payeeName,
      am: formatDecimalAmount(input.amountMinor),
      cu: 'INR',
      tn: input.note,
      tr: input.transactionReference
    });
    return `upi://pay?${params.toString()}`;
  }
}

function isValidVpa(value: string): boolean {
  return /^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.-]{2,64}$/.test(value);
}
