export interface UpiUriInput {
    payeeVpa: string;
    payeeName: string;
    amountMinor: number;
    currencyCode?: string;
    note: string;
    transactionReference: string;
}
export declare class UpiUriBuilder {
    build(input: UpiUriInput): string;
}
