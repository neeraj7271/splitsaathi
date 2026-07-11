import { BalanceProjector, type ParticipantBalanceRow } from '../ledger';

export interface GroupBalanceSummary {
  groupId: string;
  balances: ParticipantBalanceRow[];
  totalsByCurrency: Array<{
    currencyCode: string;
    amountMinor: number;
  }>;
}

export class BalanceQueryService {
  constructor(private readonly balances: BalanceProjector) {}

  getGroupBalances(groupId: string): GroupBalanceSummary {
    const rows = this.balances.listGroupBalances(groupId);
    const totals = new Map<string, number>();
    for (const row of rows) {
      totals.set(row.currencyCode, (totals.get(row.currencyCode) ?? 0) + row.amountMinor);
    }
    return {
      groupId,
      balances: rows,
      totalsByCurrency: [...totals.entries()].map(([currencyCode, amountMinor]) => ({
        currencyCode,
        amountMinor
      }))
    };
  }

  assertZeroSum(groupId: string): void {
    this.balances.assertZeroSum(groupId);
  }
}
