export interface MoneyDto {
  amountMinor: number;
  currencyCode: string;
}

export interface ParticipantAmountDto extends MoneyDto {
  participantId: string;
}

export function formatInr(amountMinor: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amountMinor / 100);
}
