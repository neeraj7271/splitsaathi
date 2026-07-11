import type { DomainEvent } from './ledger.types';
import type { Projector } from './projection-runner';

export interface ParticipantBalanceRow {
  groupId: string;
  participantId: string;
  currencyCode: string;
  amountMinor: number;
}

function balanceKey(groupId: string, participantId: string, currencyCode: string): string {
  return `${groupId}:${participantId}:${currencyCode}`;
}

export class BalanceProjector implements Projector {
  readonly name = 'group_balance_projection';

  private readonly balances = new Map<string, ParticipantBalanceRow>();

  apply(event: DomainEvent): void {
    if (!event.groupId || event.postings.length === 0) {
      return;
    }

    for (const posting of event.postings) {
      const key = balanceKey(event.groupId, posting.participantId, posting.currencyCode);
      const existing =
        this.balances.get(key) ??
        ({
          groupId: event.groupId,
          participantId: posting.participantId,
          currencyCode: posting.currencyCode,
          amountMinor: 0
        } satisfies ParticipantBalanceRow);
      existing.amountMinor += posting.signedAmountMinor;
      this.balances.set(key, existing);
    }
  }

  listGroupBalances(groupId: string): ParticipantBalanceRow[] {
    return [...this.balances.values()]
      .filter((row) => row.groupId === groupId && row.amountMinor !== 0)
      .sort((left, right) => {
        if (left.currencyCode !== right.currencyCode) return left.currencyCode.localeCompare(right.currencyCode);
        return left.participantId.localeCompare(right.participantId);
      });
  }

  getParticipantBalance(groupId: string, participantId: string, currencyCode = 'INR'): ParticipantBalanceRow {
    return (
      this.balances.get(balanceKey(groupId, participantId, currencyCode)) ?? {
        groupId,
        participantId,
        currencyCode,
        amountMinor: 0
      }
    );
  }

  assertZeroSum(groupId: string): void {
    const totals = new Map<string, number>();
    for (const row of this.listGroupBalances(groupId)) {
      totals.set(row.currencyCode, (totals.get(row.currencyCode) ?? 0) + row.amountMinor);
    }
    for (const [currencyCode, total] of totals.entries()) {
      if (total !== 0) {
        throw new Error(`Balance projection for group ${groupId} is not zero-sum for ${currencyCode}: ${total}.`);
      }
    }
  }

  reset(): void {
    this.balances.clear();
  }
}
