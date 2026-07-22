import type { DomainEvent } from './ledger.types';
import type { Projector } from './projection-runner';

export interface ActivityFeedRow {
  eventId: string;
  groupId?: string;
  type: string;
  actorId?: string;
  occurredAt: string;
  title: string;
  body: string;
  amountMinor?: number;
  currencyCode?: string;
  entityType: string;
  entityId: string;
  status?: string;
  context: Record<string, unknown>;
  searchText: string;
  globalPosition: number;
}

export interface ActivityFeedPage {
  items: ActivityFeedRow[];
  nextCursor: number | null;
}

export interface ActivityFeedQuery {
  limit?: number;
  cursor?: number;
}

type ActivityCopy = Pick<ActivityFeedRow, 'title' | 'body' | 'amountMinor' | 'currencyCode' | 'entityType' | 'entityId' | 'status' | 'context'>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asParticipantIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((row) => asRecord(row).participantId)
    .filter((id): id is string => typeof id === 'string');
}

function humanizeEventType(type: string): string {
  return type
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();
}

function expenseCopy(event: DomainEvent, payload: Record<string, unknown>): ActivityCopy {
  const description = String(payload.description ?? 'Expense');
  const total = typeof payload.totalAmountMinor === 'number' ? payload.totalAmountMinor : undefined;
  const currencyCode = typeof payload.currencyCode === 'string' ? payload.currencyCode : undefined;
  const splitTypes = Array.isArray(payload.shares)
    ? [...new Set(payload.shares.map((share) => asRecord(share).shareType).filter((type): type is string => typeof type === 'string'))]
    : [];
  const action =
    event.type === 'ExpenseCreated' ? 'added' : event.type === 'ExpenseAdjusted' ? 'updated' : 'voided';
  const reason = typeof payload.reason === 'string' ? payload.reason : undefined;
  const payerIds = asParticipantIds(payload.payers);
  const participantIds = asParticipantIds(payload.shares);
  const bodyParts = [
    total !== undefined ? `Total ${total} ${currencyCode ?? ''}`.trim() : undefined,
    payerIds.length ? 'paid by members' : undefined,
    splitTypes.length
      ? `${splitTypes.join('/')} split across members`
      : participantIds.length
        ? 'split across members'
        : undefined,
    reason ? `Reason: ${reason}` : undefined
  ].filter(Boolean);
  return {
    title: `${description} ${action}`,
    body: bodyParts.join(' · ') || `Expense ${action}.`,
    amountMinor: total,
    currencyCode,
    entityType: 'expense',
    entityId: String(payload.expenseId ?? event.aggregateId),
    status: event.type === 'ExpenseVoided' ? 'voided' : 'active',
    context: {
      description,
      splitTypes,
      payerParticipantIds: payerIds,
      shareParticipantIds: participantIds,
      reason
    }
  };
}

function settlementCopy(event: DomainEvent, payload: Record<string, unknown>): ActivityCopy {
  const method = typeof payload.paymentMethod === 'string' ? payload.paymentMethod : undefined;
  const amountMinor = typeof payload.amountMinor === 'number' ? payload.amountMinor : undefined;
  const currencyCode = typeof payload.currencyCode === 'string' ? payload.currencyCode : undefined;
  const payer = typeof payload.payerParticipantId === 'string' ? payload.payerParticipantId : undefined;
  const payee = typeof payload.payeeParticipantId === 'string' ? payload.payeeParticipantId : undefined;
  const labels: Partial<Record<DomainEvent['type'], string>> = {
    SettlementIntentCreated: 'Settlement requested',
    CashSettlementRecorded: 'Cash settlement recorded',
    UpiIntentGenerated: 'UPI payment ready',
    UpiAppOpened: 'UPI app opened',
    PaymentProofSubmitted: 'Payment proof submitted',
    PaymentAutoMatched: 'Payment matched',
    ReceiverConfirmationRequested: 'Receiver confirmation requested',
    SettlementConfirmed: 'Settlement confirmed',
    SettlementLedgerPosted: 'Settlement posted to balances',
    SettlementRejected: 'Settlement rejected',
    SettlementDisputed: 'Settlement disputed',
    SettlementReversed: 'Settlement reversed',
    SettlementRefunded: 'Settlement refunded',
    SettlementExpired: 'Settlement expired',
    SettlementCancelled: 'Settlement cancelled'
  };
  const statuses: Partial<Record<DomainEvent['type'], string>> = {
    SettlementIntentCreated: 'intent_created',
    CashSettlementRecorded: 'confirmed',
    UpiIntentGenerated: 'intent_generated',
    UpiAppOpened: 'payer_opened_upi_app',
    PaymentProofSubmitted: 'proof_submitted',
    PaymentAutoMatched: 'auto_matched',
    ReceiverConfirmationRequested: 'awaiting_receiver_confirmation',
    SettlementConfirmed: 'confirmed',
    SettlementLedgerPosted: 'ledger_posted',
    SettlementRejected: 'rejected',
    SettlementDisputed: 'disputed',
    SettlementReversed: 'reversed',
    SettlementRefunded: 'refunded',
    SettlementExpired: 'expired',
    SettlementCancelled: 'cancelled'
  };
  const reason = typeof payload.reason === 'string' ? payload.reason : undefined;
  const amountNote =
    amountMinor !== undefined ? `amountMinor ${amountMinor}${currencyCode ? ` ${currencyCode}` : ''}` : undefined;
  return {
    title: labels[event.type] ?? event.type,
    body: ['Settlement update', amountNote, method, reason, payer && payee ? 'A member paid another member' : undefined]
      .filter(Boolean)
      .join(' · '),
    amountMinor,
    currencyCode,
    entityType: 'settlement_intent',
    entityId: String(payload.settlementIntentId ?? event.aggregateId),
    status: statuses[event.type],
    context: { payerParticipantId: payer, payeeParticipantId: payee, paymentMethod: method, reason }
  };
}

function isSettlementLikeEvent(type: string): boolean {
  return (
    type.startsWith('Settlement') ||
    type.includes('Payment') ||
    type.includes('Upi') ||
    type.startsWith('Cash') ||
    type.startsWith('Receiver')
  );
}

function eventCopy(event: DomainEvent, payload = asRecord(event.payload)): ActivityCopy {
  if (event.type.startsWith('Expense')) {
    return expenseCopy(event, payload);
  }
  if (isSettlementLikeEvent(event.type)) {
    return settlementCopy(event, payload);
  }
  return {
    title: event.type,
    body: humanizeEventType(event.type),
    entityType: event.aggregateType,
    entityId: event.aggregateId,
    context: payload
  };
}

function paginateRows(rows: ActivityFeedRow[], query: ActivityFeedQuery = {}): ActivityFeedPage {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
  const filtered =
    query.cursor !== undefined
      ? rows.filter((row) => row.globalPosition < query.cursor!)
      : rows;
  const items = filtered.slice(0, limit).map((row) => ({ ...row }));
  const nextCursor =
    filtered.length > limit ? items[items.length - 1]?.globalPosition ?? null : null;
  return { items, nextCursor };
}

export class ActivityProjector implements Projector {
  readonly name = 'activity_feed_projection';

  private readonly rows: ActivityFeedRow[] = [];
  private readonly settlementDetails = new Map<string, Record<string, unknown>>();

  apply(event: DomainEvent): void {
    const eventPayload = asRecord(event.payload);
    const settlementId = typeof eventPayload.settlementIntentId === 'string' ? eventPayload.settlementIntentId : event.aggregateId;
    if (event.type === 'SettlementIntentCreated') {
      this.settlementDetails.set(settlementId, { ...eventPayload });
    }
    const payload = isSettlementLikeEvent(event.type)
      ? { ...this.settlementDetails.get(settlementId), ...eventPayload }
      : eventPayload;
    const copy = eventCopy(event, payload);
    this.rows.push({
      eventId: event.eventId,
      groupId: event.groupId,
      type: event.type,
      actorId: event.actorId,
      occurredAt: event.occurredAt,
      ...copy,
      searchText: `${copy.title} ${copy.body} ${JSON.stringify(copy.context)} ${JSON.stringify(payload)}`.toLowerCase(),
      globalPosition: event.globalPosition
    });
  }

  listGroupActivity(groupId: string, query: ActivityFeedQuery = {}): ActivityFeedPage {
    const rows = this.rows
      .filter((row) => row.groupId === groupId)
      .sort((left, right) => right.globalPosition - left.globalPosition);
    return paginateRows(rows, query);
  }

  search(groupId: string, queryText: string, query: ActivityFeedQuery = {}): ActivityFeedPage {
    const normalized = queryText.trim().toLowerCase();
    const rows = this.rows
      .filter((row) => row.groupId === groupId)
      .sort((left, right) => right.globalPosition - left.globalPosition)
      .filter((row) => (!normalized ? true : row.searchText.includes(normalized)));
    return paginateRows(rows, query);
  }

  reset(): void {
    this.rows.length = 0;
    this.settlementDetails.clear();
  }
}
