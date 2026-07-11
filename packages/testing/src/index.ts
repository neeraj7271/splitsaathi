import { BalancedPostingSet, type LedgerPostingInput } from '@splitsaathi/domain';

export interface TestParticipant {
  id: string;
  displayName: string;
}

export interface TestGroup {
  id: string;
  title: string;
  participants: TestParticipant[];
}

export interface TestExpenseCommand {
  groupId: string;
  expenseId: string;
  description: string;
  expenseDate: string;
  currencyCode: string;
  payers: Array<{ participantId: string; amountMinor: number }>;
  shares: Array<{ participantId: string; shareType: 'equal' }>;
}

export function testParticipant(index: number, overrides: Partial<TestParticipant> = {}): TestParticipant {
  return {
    id: overrides.id ?? `participant-${index}`,
    displayName: overrides.displayName ?? `Member ${index}`,
    ...overrides
  };
}

export function testGroup(count = 2, overrides: Partial<Omit<TestGroup, 'participants'>> = {}): TestGroup {
  return {
    id: overrides.id ?? 'group-test-1',
    title: overrides.title ?? 'Shared home',
    participants: Array.from({ length: count }, (_, index) => testParticipant(index + 1)),
    ...overrides
  };
}

export function equalSplitExpense(overrides: Partial<TestExpenseCommand> = {}): TestExpenseCommand {
  const group = testGroup(2);
  return {
    groupId: overrides.groupId ?? group.id,
    expenseId: overrides.expenseId ?? 'expense-test-1',
    description: overrides.description ?? 'Dinner',
    expenseDate: overrides.expenseDate ?? '2026-07-10',
    currencyCode: overrides.currencyCode ?? 'INR',
    payers: overrides.payers ?? [{ participantId: group.participants[0].id, amountMinor: 10000 }],
    shares:
      overrides.shares ??
      group.participants.map((participant) => ({
        participantId: participant.id,
        shareType: 'equal'
      })),
    ...overrides
  };
}

export function assertBalancedByCurrency(postings: LedgerPostingInput[]): void {
  BalancedPostingSet.create(postings);
}

export function ledgerPostingsTotalByCurrency(postings: LedgerPostingInput[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const posting of postings) {
    totals.set(posting.currencyCode, (totals.get(posting.currencyCode) ?? 0) + posting.signedAmountMinor);
  }
  return totals;
}
