import type { DomainEvent } from './ledger.types';
import type { Projector } from './projection-runner';

export interface ExpensePayerRow {
  participantId: string;
  amountMinor: number;
}

export interface ExpenseShareRow {
  participantId: string;
  amountMinor: number;
  shareType: string;
  roundingDeltaMinor: number;
}

export interface ExpenseLineItemRow {
  label: string;
  amountMinor: number;
  participantIds: string[];
}

export interface BillAdjustmentRow {
  adjustmentType: string;
  label: string;
  amountMinor: number;
  allocationBasis: string;
}

export interface ExpenseProjectionRow {
  expenseId: string;
  groupId: string;
  description: string;
  category?: string;
  notes?: string;
  expenseDate: string;
  currencyCode: string;
  totalAmountMinor: number;
  payers: ExpensePayerRow[];
  shares: ExpenseShareRow[];
  lineItems: ExpenseLineItemRow[];
  billAdjustments: BillAdjustmentRow[];
  status: 'active' | 'voided';
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  voidedAt?: string;
  voidReason?: string;
}

export interface ExpenseVersionRow {
  expenseId: string;
  groupId: string;
  eventId: string;
  eventType: string;
  version: number;
  actorId?: string;
  occurredAt: string;
  reason?: string;
  changes: ExpenseChange[];
  before?: ExpenseProjectionRow;
  after?: ExpenseProjectionRow;
}

export interface ExpenseChange {
  field: string;
  before?: unknown;
  after?: unknown;
  detail: string;
}

type ExpenseSnapshotPayload = Omit<
  ExpenseProjectionRow,
  'status' | 'version' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt' | 'voidedAt' | 'voidReason'
>;

function cloneExpense(row: ExpenseProjectionRow): ExpenseProjectionRow {
  return {
    ...row,
    notes: row.notes,
    payers: row.payers.map((payer) => ({ ...payer })),
    shares: row.shares.map((share) => ({ ...share })),
    lineItems: row.lineItems.map((item) => ({ ...item, participantIds: [...item.participantIds] })),
    billAdjustments: row.billAdjustments.map((adjustment) => ({ ...adjustment }))
  };
}

function equivalent(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function formatMoneyMinor(amountMinor: number, currencyCode = 'INR'): string {
  const major = (Math.abs(amountMinor) / 100).toFixed(2);
  const signed = amountMinor < 0 ? '-' : '';
  return currencyCode === 'INR' ? `${signed}₹${major}` : `${signed}${major} ${currencyCode}`;
}

function asAmountMinor(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }
  return undefined;
}

function describeMoneyRows(
  value: unknown,
  currencyCode: string
): string | undefined {
  if (!Array.isArray(value) || !value.length) {
    return Array.isArray(value) && value.length === 0 ? 'none' : undefined;
  }
  if (!value.every((row) => row && typeof row === 'object' && 'amountMinor' in (row as object))) {
    return undefined;
  }
  return (value as Array<{ participantId?: string; amountMinor: unknown; shareType?: string; label?: string }>)
    .map((row) => {
      const amount = asAmountMinor(row.amountMinor) ?? 0;
      const who = row.label?.trim() || (row.participantId ? row.participantId.slice(0, 8) : 'member');
      const share = row.shareType ? ` (${row.shareType})` : '';
      return `${who} ${formatMoneyMinor(amount, currencyCode)}${share}`;
    })
    .join('; ');
}

function describeValue(value: unknown, currencyCode = 'INR', asMoney = false): string {
  if (asMoney) {
    const amount = asAmountMinor(value);
    if (amount !== undefined) {
      return formatMoneyMinor(amount, currencyCode);
    }
  }

  const moneyRows = describeMoneyRows(value, currencyCode);
  if (moneyRows !== undefined) {
    return moneyRows;
  }

  if (Array.isArray(value)) {
    return value.length ? `${value.length} record${value.length === 1 ? '' : 's'}` : 'none';
  }
  if (value == null || value === '') {
    return 'none';
  }
  return String(value);
}

function expenseChanges(before: ExpenseProjectionRow | undefined, after: ExpenseProjectionRow): ExpenseChange[] {
  if (!before) {
    return [
      {
        field: 'expense',
        after: after.description,
        detail: `Created "${after.description}" for ${formatMoneyMinor(after.totalAmountMinor, after.currencyCode)}.`
      }
    ];
  }
  const fields: Array<
    keyof Pick<
      ExpenseProjectionRow,
      | 'description'
      | 'category'
      | 'notes'
      | 'expenseDate'
      | 'currencyCode'
      | 'totalAmountMinor'
      | 'payers'
      | 'shares'
      | 'lineItems'
      | 'billAdjustments'
      | 'status'
    >
  > = [
    'description',
    'category',
    'notes',
    'expenseDate',
    'currencyCode',
    'totalAmountMinor',
    'payers',
    'shares',
    'lineItems',
    'billAdjustments',
    'status'
  ];
  const labels: Record<string, string> = {
    description: 'Description',
    category: 'Category',
    notes: 'Notes',
    expenseDate: 'Date',
    currencyCode: 'Currency',
    totalAmountMinor: 'Total',
    payers: 'Paid by',
    shares: 'Split',
    lineItems: 'Items',
    billAdjustments: 'Adjustments',
    status: 'Status'
  };
  return fields
    .filter((field) => !equivalent(before[field], after[field]))
    .map((field) => ({
      field,
      before: before[field],
      after: after[field],
      detail: `${labels[field] ?? field}: ${describeValue(
        before[field],
        after.currencyCode,
        field === 'totalAmountMinor'
      )} → ${describeValue(after[field], after.currencyCode, field === 'totalAmountMinor')}`
    }));
}

export class ExpenseProjector implements Projector {
  readonly name = 'expense_projection';

  private readonly expenses = new Map<string, ExpenseProjectionRow>();
  private readonly versions: ExpenseVersionRow[] = [];

  apply(event: DomainEvent): void {
    if (event.type === 'ExpenseCreated') {
      const payload = event.payload as ExpenseSnapshotPayload & { reason?: string };
      const row: ExpenseProjectionRow = {
        ...payload,
        payers: payload.payers.map((payer) => ({ ...payer })),
        shares: payload.shares.map((share) => ({ ...share })),
        lineItems: payload.lineItems.map((item) => ({ ...item, participantIds: [...item.participantIds] })),
        billAdjustments: payload.billAdjustments.map((adjustment) => ({ ...adjustment })),
        status: 'active',
        version: event.aggregateVersion,
        createdBy: event.actorId ?? 'system',
        updatedBy: event.actorId ?? 'system',
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt
      };
      this.expenses.set(row.expenseId, row);
      this.versions.push({
        expenseId: row.expenseId,
        groupId: row.groupId,
        eventId: event.eventId,
        eventType: event.type,
        version: event.aggregateVersion,
        actorId: event.actorId,
        occurredAt: event.occurredAt,
        reason: payload.reason,
        changes: expenseChanges(undefined, row),
        after: cloneExpense(row)
      });
      return;
    }

    if (event.type === 'ExpenseAdjusted') {
      const payload = event.payload as ExpenseSnapshotPayload & { reason?: string };
      const existing = this.expenses.get(payload.expenseId);
      if (!existing) {
        throw new Error(`Cannot project adjustment for missing expense ${payload.expenseId}.`);
      }
      const before = cloneExpense(existing);
      const after: ExpenseProjectionRow = {
        ...existing,
        ...payload,
        payers: payload.payers.map((payer) => ({ ...payer })),
        shares: payload.shares.map((share) => ({ ...share })),
        lineItems: payload.lineItems.map((item) => ({ ...item, participantIds: [...item.participantIds] })),
        billAdjustments: payload.billAdjustments.map((adjustment) => ({ ...adjustment })),
        status: 'active',
        version: event.aggregateVersion,
        updatedBy: event.actorId ?? existing.updatedBy,
        updatedAt: event.occurredAt
      };
      this.expenses.set(after.expenseId, after);
      this.versions.push({
        expenseId: after.expenseId,
        groupId: after.groupId,
        eventId: event.eventId,
        eventType: event.type,
        version: event.aggregateVersion,
        actorId: event.actorId,
        occurredAt: event.occurredAt,
        reason: payload.reason,
        changes: expenseChanges(before, after),
        before,
        after: cloneExpense(after)
      });
      return;
    }

    if (event.type === 'ExpenseVoided') {
      const payload = event.payload as { expenseId: string; groupId: string; reason?: string };
      const existing = this.expenses.get(payload.expenseId);
      if (!existing) {
        throw new Error(`Cannot project void for missing expense ${payload.expenseId}.`);
      }
      const before = cloneExpense(existing);
      const after: ExpenseProjectionRow = {
        ...existing,
        status: 'voided',
        version: event.aggregateVersion,
        updatedBy: event.actorId ?? existing.updatedBy,
        updatedAt: event.occurredAt,
        voidedAt: event.occurredAt,
        voidReason: payload.reason
      };
      this.expenses.set(after.expenseId, after);
      this.versions.push({
        expenseId: after.expenseId,
        groupId: after.groupId,
        eventId: event.eventId,
        eventType: event.type,
        version: event.aggregateVersion,
        actorId: event.actorId,
        occurredAt: event.occurredAt,
        reason: payload.reason,
        changes: expenseChanges(before, after),
        before,
        after: cloneExpense(after)
      });
    }
  }

  getExpense(expenseId: string): ExpenseProjectionRow | undefined {
    const row = this.expenses.get(expenseId);
    return row ? cloneExpense(row) : undefined;
  }

  listGroupExpenses(groupId: string): ExpenseProjectionRow[] {
    return [...this.expenses.values()]
      .filter((row) => row.groupId === groupId)
      .sort((left, right) => right.expenseDate.localeCompare(left.expenseDate) || right.updatedAt.localeCompare(left.updatedAt))
      .map((row) => cloneExpense(row));
  }

  listExpenseHistory(expenseId: string): ExpenseVersionRow[] {
    return this.versions
      .filter((version) => version.expenseId === expenseId)
      .map((version) => ({
        ...version,
        changes: version.changes.map((change) => ({ ...change })),
        before: version.before ? cloneExpense(version.before) : undefined,
        after: version.after ? cloneExpense(version.after) : undefined
      }));
  }

  reset(): void {
    this.expenses.clear();
    this.versions.length = 0;
  }
}
