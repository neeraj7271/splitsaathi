import { GreedySettlementOptimizer } from '@splitsaathi/domain';
import { BalanceProjector } from '../ledger';

export class SettlementSuggestionService {
  private readonly optimizer = new GreedySettlementOptimizer();

  constructor(private readonly balances: BalanceProjector) {}

  suggestForGroup(groupId: string): ReturnType<GreedySettlementOptimizer['suggest']> {
    return this.optimizer.suggest(
      this.balances.listGroupBalances(groupId).map((row) => ({
        participantId: row.participantId,
        amountMinor: row.amountMinor,
        currencyCode: row.currencyCode
      }))
    );
  }
}
