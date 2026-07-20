import { GreedySettlementOptimizer, type SettlementExpenseHint } from '@splitsaathi/domain';
import { BalanceProjector, ExpenseProjector } from '../ledger';

export class SettlementSuggestionService {
  private readonly optimizer = new GreedySettlementOptimizer();

  constructor(
    private readonly balances: BalanceProjector,
    private readonly expenses: ExpenseProjector
  ) {}

  suggestForGroup(groupId: string): ReturnType<GreedySettlementOptimizer['suggest']> {
    const expenseHints: SettlementExpenseHint[] = this.expenses
      .listGroupExpenses(groupId)
      .filter((expense) => expense.status === 'active')
      .map((expense) => ({
        description: expense.description,
        participantIds: [
          ...new Set([
            ...expense.payers.map((payer) => payer.participantId),
            ...expense.shares.map((share) => share.participantId)
          ])
        ]
      }));

    return this.optimizer.suggest(
      this.balances.listGroupBalances(groupId).map((row) => ({
        participantId: row.participantId,
        amountMinor: row.amountMinor,
        currencyCode: row.currencyCode
      })),
      expenseHints
    );
  }
}
