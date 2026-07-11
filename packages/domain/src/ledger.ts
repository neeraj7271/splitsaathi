export interface LedgerPostingInput {
  participantId: string;
  currencyCode: string;
  signedAmountMinor: number;
  postingType: string;
  sourceType: string;
  sourceId: string;
}

export class BalancedPostingSet {
  private constructor(public readonly postings: LedgerPostingInput[]) {}

  static create(postings: LedgerPostingInput[]): BalancedPostingSet {
    const totals = new Map<string, number>();
    for (const posting of postings) {
      if (!Number.isInteger(posting.signedAmountMinor)) {
        throw new Error('Ledger posting amounts must use integer minor units.');
      }
      totals.set(posting.currencyCode, (totals.get(posting.currencyCode) ?? 0) + posting.signedAmountMinor);
    }
    for (const [currencyCode, total] of totals.entries()) {
      if (total !== 0) {
        throw new Error(`Ledger postings must balance to zero for ${currencyCode}; got ${total}.`);
      }
    }
    return new BalancedPostingSet(postings);
  }
}
