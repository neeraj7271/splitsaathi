import type { SplitType } from '@splitsaathi/contracts';
import type {
  BillAdjustmentRow,
  ExpenseLineItemRow,
  ExpensePayerRow,
  ExpenseProjectionRow,
  ExpenseShareRow
} from '../ledger';

export type { BillAdjustmentRow, ExpenseLineItemRow, ExpensePayerRow, ExpenseProjectionRow, ExpenseShareRow };

export interface ExpensePayerInput extends ExpensePayerRow {}

export interface ExpenseShareInput {
  participantId: string;
  shareType: SplitType;
  amountMinor?: number;
  weightNumerator?: number;
  weightDenominator?: number;
}

export interface CreateExpenseCommand {
  idempotencyKey: string;
  actorId: string;
  groupId: string;
  expenseId?: string;
  description: string;
  category?: string;
  notes?: string;
  expenseDate: string;
  currencyCode?: string;
  payers: ExpensePayerInput[];
  shares: ExpenseShareInput[];
  lineItems?: ExpenseLineItemRow[];
  billAdjustments?: BillAdjustmentRow[];
  reason?: string;
}

export interface ReviseExpenseCommand extends Omit<CreateExpenseCommand, 'expenseId'> {
  expenseId: string;
  expectedVersion: number;
}

export interface VoidExpenseCommand {
  idempotencyKey: string;
  actorId: string;
  groupId: string;
  expenseId: string;
  expectedVersion: number;
  reason: string;
}

export type ExpenseSnapshot = Omit<
  ExpenseProjectionRow,
  'status' | 'version' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt' | 'voidedAt' | 'voidReason'
>;

export interface ExpenseAllocationResult {
  shares: ExpenseShareRow[];
  roundingResiduals: Array<{
    participantId: string;
    currencyCode: string;
    residualMinor: number;
    reason: string;
  }>;
}
