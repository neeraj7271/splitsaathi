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

type ActivityCopy = Pick<ActivityFeedRow, 'title' | 'body' | 'amountMinor' | 'currencyCode' | 'entityType' | 'entityId' | 'status' | 'context'>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asParticipantList(value: unknown): string {
  if (!Array.isArray(value)) {
    return '';
  }
  return value
    .map((row) => asRecord(row).participantId)
    .filter((id): id is string => typeof id === 'string')
    .join(', ');
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
  const payerIds = asParticipantList(payload.payers);
  const participantIds = asParticipantList(payload.shares);
  const bodyParts = [
    total !== undefined ? `Total ${total} ${currencyCode ?? ''}`.trim() : undefined,
    payerIds ? `paid by ${payerIds}` : undefined,
    splitTypes.length ? `${splitTypes.join('/')} split across ${participantIds || 'participants'}` : undefined,
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
      payerParticipantIds: payerIds ? payerIds.split(', ') : [],
      shareParticipantIds: participantIds ? participantIds.split(', ') : [],
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
  const route = payer && payee ? `${payer} → ${payee}` : undefined;
  return {
    title: labels[event.type] ?? event.type,
    body: [route, amountMinor !== undefined ? `${amountMinor} ${currencyCode ?? ''}`.trim() : undefined, method, reason].filter(Boolean).join(' · ') || 'Settlement activity.',
    amountMinor,
    currencyCode,
    entityType: 'settlement_intent',
    entityId: String(payload.settlementIntentId ?? event.aggregateId),
    status: statuses[event.type],
    context: { payerParticipantId: payer, payeeParticipantId: payee, paymentMethod: method, reason }
  };
}

function eventCopy(event: DomainEvent, payload = asRecord(event.payload)): ActivityCopy {
  if (event.type.startsWith('Expense')) {
    return expenseCopy(event, payload);
  }
  if (event.type.startsWith('Settlement') || event.type.includes('Payment') || event.type.includes('Upi') || event.type.startsWith('Cash')) {
    return settlementCopy(event, payload);
  }
  return {
    title: event.type,
    body: `Record ${event.aggregateId}`,
    entityType: event.aggregateType,
    entityId: event.aggregateId,
    context: payload
  };
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
    const payload =
      event.type.startsWith('Settlement') || event.type.includes('Payment') || event.type.includes('Upi') || event.type.startsWith('Cash')
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

  listGroupActivity(groupId: string): ActivityFeedRow[] {
    return this.rows
      .filter((row) => row.groupId === groupId)
      .sort((left, right) => right.globalPosition - left.globalPosition)
      .map((row) => ({ ...row }));
  }

  search(groupId: string, query: string): ActivityFeedRow[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return this.listGroupActivity(groupId);
    }
    return this.listGroupActivity(groupId).filter((row) => row.searchText.includes(normalized));
  }

  reset(): void {
    this.rows.length = 0;
    this.settlementDetails.clear();
  }
}
