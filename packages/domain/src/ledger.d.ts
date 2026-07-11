export interface LedgerPostingInput {
    participantId: string;
    currencyCode: string;
    signedAmountMinor: number;
    postingType: string;
    sourceType: string;
    sourceId: string;
}
export declare class BalancedPostingSet {
    readonly postings: LedgerPostingInput[];
    private constructor();
    static create(postings: LedgerPostingInput[]): BalancedPostingSet;
}
