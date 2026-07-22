export interface NetBalance {
  participantId: string;
  amountMinor: number;
  currencyCode: string;
}

export interface SettlementSuggestion {
  payerParticipantId: string;
  payeeParticipantId: string;
  amountMinor: number;
  currencyCode: string;
  explanation: string;
}

export interface SettlementExpenseHint {
  description: string;
  participantIds: string[];
}

function formatExpenseNames(names: string[]): string {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  if (!unique.length) {
    return 'shared group expenses';
  }
  if (unique.length === 1) {
    return unique[0];
  }
  if (unique.length === 2) {
    return `${unique[0]} and ${unique[1]}`;
  }
  return `${unique.slice(0, -1).join(', ')}, and ${unique[unique.length - 1]}`;
}

export function buildSettlementExplanation(
  payerParticipantId: string,
  payeeParticipantId: string,
  expenseHints: SettlementExpenseHint[] = []
): string {
  const relatedNames = expenseHints
    .filter((expense) => {
      const ids = new Set(expense.participantIds);
      return ids.has(payerParticipantId) && ids.has(payeeParticipantId);
    })
    .map((expense) => expense.description)
    .slice(0, 3);

  return `Someone owes this amount to settle ${formatExpenseNames(relatedNames)}.`;
}

export class GreedySettlementOptimizer {
  suggest(balances: NetBalance[], expenseHints: SettlementExpenseHint[] = []): SettlementSuggestion[] {
    const byCurrency = new Map<string, NetBalance[]>();
    for (const balance of balances) {
      if (balance.amountMinor === 0) continue;
      byCurrency.set(balance.currencyCode, [...(byCurrency.get(balance.currencyCode) ?? []), balance]);
    }

    const suggestions: SettlementSuggestion[] = [];
    for (const [currencyCode, rows] of byCurrency.entries()) {
      const debtors = rows
        .filter((row) => row.amountMinor < 0)
        .map((row) => ({ ...row, amountMinor: Math.abs(row.amountMinor) }))
        .sort((left, right) => right.amountMinor - left.amountMinor);
      const creditors = rows
        .filter((row) => row.amountMinor > 0)
        .map((row) => ({ ...row }))
        .sort((left, right) => right.amountMinor - left.amountMinor);

      let debtorIndex = 0;
      let creditorIndex = 0;
      while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
        const debtor = debtors[debtorIndex];
        const creditor = creditors[creditorIndex];
        const amountMinor = Math.min(debtor.amountMinor, creditor.amountMinor);
        suggestions.push({
          payerParticipantId: debtor.participantId,
          payeeParticipantId: creditor.participantId,
          amountMinor,
          currencyCode,
          explanation: buildSettlementExplanation(debtor.participantId, creditor.participantId, expenseHints)
        });
        debtor.amountMinor -= amountMinor;
        creditor.amountMinor -= amountMinor;
        if (debtor.amountMinor === 0) debtorIndex += 1;
        if (creditor.amountMinor === 0) creditorIndex += 1;
      }
    }
    return suggestions;
  }
}
