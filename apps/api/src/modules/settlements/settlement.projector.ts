import type { SettlementState } from '@splitsaathi/contracts';
import { SettlementStateMachine, type SettlementEventName } from '@splitsaathi/domain';
import type { DomainEvent, Projector } from '../ledger';
import type { PaymentProofRow, SettlementIntentRow } from './settlement.types';

function cloneIntent(row: SettlementIntentRow): SettlementIntentRow {
  return {
    ...row,
    proofs: row.proofs.map((proof) => ({ ...proof })),
    appOpenEvents: row.appOpenEvents.map((open) => ({ ...open })),
    timeline: row.timeline.map((entry) => ({ ...entry }))
  };
}

function transitionForEvent(type: string): SettlementEventName | undefined {
  switch (type) {
    case 'SettlementIntentCreated':
      return 'create_intent';
    case 'UpiIntentGenerated':
      return 'generate_intent';
    case 'UpiAppOpened':
      return 'open_upi_app';
    case 'CashSettlementRecorded':
      return 'record_cash';
    case 'PaymentProofSubmitted':
      return 'submit_proof';
    case 'PaymentAutoMatched':
      return 'auto_match';
    case 'ReceiverConfirmationRequested':
      return 'request_confirmation';
    case 'SettlementConfirmed':
      return 'confirm';
    case 'SettlementLedgerPosted':
      return 'post_ledger';
    case 'SettlementRejected':
      return 'reject';
    case 'SettlementDisputed':
      return 'dispute';
    case 'SettlementReversed':
      return 'reverse';
    case 'SettlementRefunded':
      return 'refund';
    case 'PartialPaymentDetected':
      return 'detect_partial';
    case 'DuplicatePaymentReferenceDetected':
      return 'detect_duplicate';
    case 'SettlementExpired':
      return 'expire';
    case 'SettlementCancelled':
      return 'cancel';
    default:
      return undefined;
  }
}

export class SettlementProjector implements Projector {
  readonly name = 'settlement_intent_projection';

  private readonly machine = new SettlementStateMachine();
  private readonly intents = new Map<string, SettlementIntentRow>();
  private readonly paymentReferenceIndex = new Map<string, string>();

  apply(event: DomainEvent): void {
    if (
      !event.type.startsWith('Settlement') &&
      !event.type.startsWith('Cash') &&
      !event.type.includes('Payment') &&
      !event.type.includes('Upi') &&
      !event.type.includes('Receiver')
    ) {
      return;
    }

    if (event.type === 'SettlementIntentCreated') {
      const payload = event.payload as {
        settlementIntentId: string;
        groupId: string;
        payerParticipantId: string;
        payeeParticipantId: string;
        amountMinor: number;
        currencyCode: string;
        note: string;
        paymentMethod?: 'cash' | 'upi';
      };
      const state = this.machine.transition('suggested', 'create_intent');
      const row: SettlementIntentRow = {
        settlementIntentId: payload.settlementIntentId,
        groupId: payload.groupId,
        payerParticipantId: payload.payerParticipantId,
        payeeParticipantId: payload.payeeParticipantId,
        amountMinor: payload.amountMinor,
        currencyCode: payload.currencyCode,
        note: payload.note,
        paymentMethod: payload.paymentMethod ?? 'upi',
        state,
        createdBy: event.actorId ?? 'system',
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
        proofs: [],
        appOpenEvents: [],
        timeline: []
      };
      this.addTimeline(row, event, state);
      this.intents.set(row.settlementIntentId, row);
      return;
    }

    const settlementIntentId = (event.payload as { settlementIntentId?: string }).settlementIntentId ?? event.aggregateId;
    const row = this.intents.get(settlementIntentId);
    if (!row) {
      throw new Error(`Cannot project settlement event for missing intent ${settlementIntentId}.`);
    }

    const transition = transitionForEvent(event.type);
    if (transition) {
      row.state = this.machine.transition(row.state, transition);
    }

    if (event.type === 'UpiIntentGenerated') {
      const payload = event.payload as {
        providerReference: string;
        upiUri: string;
        qrPayload: string;
        expiresAt: string;
        payeeVpa?: string;
      };
      row.providerReference = payload.providerReference;
      row.upiUri = payload.upiUri;
      row.qrPayload = payload.qrPayload;
      row.expiresAt = payload.expiresAt;
      if (payload.payeeVpa) {
        row.payeeVpa = payload.payeeVpa;
      }
    }

    if (event.type === 'UpiAppOpened') {
      const payload = event.payload as { upiApp?: string };
      row.appOpenEvents.push({
        settlementIntentId,
        openedBy: event.actorId ?? 'system',
        upiApp: payload.upiApp,
        openedAt: event.occurredAt
      });
    }

    if (event.type === 'PaymentProofSubmitted') {
      const payload = event.payload as Omit<PaymentProofRow, 'submittedAt' | 'submittedBy'>;
      row.proofs.push({
        ...payload,
        submittedBy: event.actorId ?? 'system',
        submittedAt: event.occurredAt
      });
      if (payload.utr) {
        this.paymentReferenceIndex.set(payload.utr, settlementIntentId);
      }
    }

    if (event.type === 'SettlementLedgerPosted') {
      row.ledgerPostedAt = event.occurredAt;
    }

    row.updatedAt = event.occurredAt;
    this.addTimeline(row, event, row.state, (event.payload as { reason?: string; note?: string }).reason);
  }

  findIntentByProofAttachmentId(attachmentId: string): SettlementIntentRow | undefined {
    for (const intent of this.intents.values()) {
      if (intent.proofs.some((proof) => proof.attachmentId === attachmentId)) {
        return cloneIntent(intent);
      }
    }
    return undefined;
  }

  getIntent(settlementIntentId: string): SettlementIntentRow | undefined {
    const row = this.intents.get(settlementIntentId);
    return row ? cloneIntent(row) : undefined;
  }

  listGroupIntents(groupId: string): SettlementIntentRow[] {
    return [...this.intents.values()]
      .filter((row) => row.groupId === groupId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((row) => cloneIntent(row));
  }

  findIntentByPaymentReference(reference: string): SettlementIntentRow | undefined {
    const settlementIntentId = this.paymentReferenceIndex.get(reference);
    return settlementIntentId ? this.getIntent(settlementIntentId) : undefined;
  }

  findIntentByProviderReference(providerReference: string): SettlementIntentRow | undefined {
    return [...this.intents.values()].find((row) => row.providerReference === providerReference);
  }

  reset(): void {
    this.intents.clear();
    this.paymentReferenceIndex.clear();
  }

  private addTimeline(row: SettlementIntentRow, event: DomainEvent, state: SettlementState, note?: string): void {
    row.timeline.push({
      eventId: event.eventId,
      type: event.type,
      state,
      actorId: event.actorId,
      occurredAt: event.occurredAt,
      note
    });
  }
}
