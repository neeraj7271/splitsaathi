export declare class Money {
    readonly amountMinor: number;
    readonly currencyCode: string;
    private constructor();
    static of(amountMinor: number, currencyCode?: string): Money;
    add(other: Money): Money;
    negate(): Money;
    private assertSameCurrency;
}
export declare function formatDecimalAmount(amountMinor: number, minorUnit?: number): string;
