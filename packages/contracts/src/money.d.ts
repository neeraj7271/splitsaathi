export interface MoneyDto {
    amountMinor: number;
    currencyCode: string;
}
export interface ParticipantAmountDto extends MoneyDto {
    participantId: string;
}
export declare function formatInr(amountMinor: number): string;
