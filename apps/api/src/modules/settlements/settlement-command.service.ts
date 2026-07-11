import { randomUUID } from 'node:crypto';
import { SettlementStateMachine, type LedgerPostingInput, type SettlementEventName } from '@splitsaathi/domain';
import { LedgerService, type DomainEvent } from '../ledger';
import { SettlementProjector } from './settlement.projector';
import { DevUpiIntentProvider, ManualPaymentGateway } from './manual-upi.providers';
import type { GatewayPaymentStatus, PaymentGatewayPort, UpiIntentProviderPort } from './upi-provider.ports';
import type {
  CreateSettlementIntentCommand,
  MarkUpiOpenedCommand,
  SettlementIntentRow,
  SettlementTransitionCommand,
  SubmitPaymentProofCommand
} from './settlement.types';

function requirePositiveAmount(amountMinor: number): void {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('Settlement amount must be a positive integer minor-unit amount.');
  }
}

function settlementPostings(intent: SettlementIntentRow, postingType: string): LedgerPostingInput[] {
  return [
    {
      participantId: intent.payerParticipantId,
      currencyCode: intent.currencyCode,
      signedAmountMinor: intent.amountMinor,
      postingType,
      sourceType: 'settlement',
      sourceId: intent.settlementIntentId
    },
    {
      participantId: intent.payeeParticipantId,
      currencyCode: intent.currencyCode,
      signedAmountMinor: -intent.amountMinor,
      postingType,
      sourceType: 'settlement',
      sourceId: intent.settlementIntentId
    }
  ];
}

export class SettlementCommandService {
  private readonly stateMachine = new SettlementStateMachine();

  constructor(
    private readonly ledger: LedgerService,
    private readonly settlements: SettlementProjector,
    private readonly upiIntentProvider: UpiIntentProviderPort = new DevUpiIntentProvider(),
    private readonly paymentGateway: PaymentGatewayPort = new ManualPaymentGateway()
  ) {}

  async createIntent(command: CreateSettlementIntentCommand): Promise<{ intent: SettlementIntentRow; events: DomainEvent[] }> {
    requirePositiveAmount(command.amountMinor);
    const settlementIntentId = command.settlementIntentId ?? randomUUID();
    const currencyCode = command.currencyCode ?? 'INR';
    const note = command.note ?? `SplitSaathi settlement ${settlementIntentId}`;
    const ledgerReference = `SS-${settlementIntentId.replaceAll('-', '').slice(0, 24).toUpperCase()}`;
    const upiIntent = this.upiIntentProvider.createIntent({
      settlementIntentId,
      payerParticipantId: command.payerParticipantId,
      payeeParticipantId: command.payeeParticipantId,
      payeeVpa: command.payeeVpa,
      payeeName: command.payeeName,
      amountMinor: command.amountMinor,
      currencyCode,
      note,
      ledgerReference
    });

    const events = await this.ledger.appendAndProject({
      aggregateType: 'settlement_intent',
      aggregateId: settlementIntentId,
      expectedVersion: 0,
      idempotencyKey: command.idempotencyKey,
      idempotencyPayload: command,
      events: [
        {
          type: 'SettlementIntentCreated',
          aggregateType: 'settlement_intent',
          aggregateId: settlementIntentId,
          groupId: command.groupId,
          actorId: command.actorId,
          payload: {
            settlementIntentId,
            groupId: command.groupId,
            payerParticipantId: command.payerParticipantId,
            payeeParticipantId: command.payeeParticipantId,
            amountMinor: command.amountMinor,
            currencyCode,
            note
          },
          metadata: { command: 'create_settlement_intent' }
        },
        {
          type: 'UpiIntentGenerated',
          aggregateType: 'settlement_intent',
          aggregateId: settlementIntentId,
          groupId: command.groupId,
          actorId: command.actorId,
          payload: {
            settlementIntentId,
            ...upiIntent
          },
          metadata: { command: 'generate_upi_intent' }
        }
      ]
    });

    const intent = this.requireIntent(events[0].aggregateId);
    return { intent, events };
  }

  async currentVersion(settlementIntentId: string): Promise<number> {
    return this.ledger.getVersion('settlement_intent', settlementIntentId);
  }

  async markUpiOpened(command: MarkUpiOpenedCommand): Promise<{ intent: SettlementIntentRow; events: DomainEvent[] }> {
    const intent = this.requireIntent(command.settlementIntentId);
    this.assertTransitionsAllowed(intent, ['open_upi_app']);
    const events = await this.ledger.appendAndProject({
      aggregateType: 'settlement_intent',
      aggregateId: command.settlementIntentId,
      expectedVersion: command.expectedVersion,
      idempotencyKey: command.idempotencyKey,
      idempotencyPayload: command,
      events: [
        {
          type: 'UpiAppOpened',
          aggregateType: 'settlement_intent',
          aggregateId: command.settlementIntentId,
          groupId: intent.groupId,
          actorId: command.actorId,
          payload: {
            settlementIntentId: command.settlementIntentId,
            upiApp: command.upiApp
          },
          metadata: { command: 'mark_upi_opened' }
        }
      ]
    });
    return { intent: this.requireIntent(command.settlementIntentId), events };
  }

  async submitProof(command: SubmitPaymentProofCommand): Promise<{ intent: SettlementIntentRow; events: DomainEvent[] }> {
    const intent = this.requireIntent(command.settlementIntentId);
    const proofId = randomUUID();
    const duplicate = command.utr ? this.settlements.findIntentByPaymentReference(command.utr) : undefined;
    const isDuplicate = Boolean(duplicate && duplicate.settlementIntentId !== command.settlementIntentId);
    const isPartial = command.amountMinor !== undefined && command.amountMinor !== intent.amountMinor;
    const gatewayStatus = intent.providerReference ? this.paymentGateway.lookupPayment(intent.providerReference) : undefined;

    const followUpType = isDuplicate
      ? 'DuplicatePaymentReferenceDetected'
      : isPartial
        ? 'PartialPaymentDetected'
        : 'ReceiverConfirmationRequested';
    this.assertTransitionsAllowed(intent, [
      'submit_proof',
      followUpType === 'DuplicatePaymentReferenceDetected'
        ? 'detect_duplicate'
        : followUpType === 'PartialPaymentDetected'
          ? 'detect_partial'
          : 'request_confirmation'
    ]);

    const events = await this.ledger.appendAndProject({
      aggregateType: 'settlement_intent',
      aggregateId: command.settlementIntentId,
      expectedVersion: command.expectedVersion,
      idempotencyKey: command.idempotencyKey,
      idempotencyPayload: command,
      events: [
        {
          type: 'PaymentProofSubmitted',
          aggregateType: 'settlement_intent',
          aggregateId: command.settlementIntentId,
          groupId: intent.groupId,
          actorId: command.actorId,
          payload: {
            proofId,
            settlementIntentId: command.settlementIntentId,
            amountMinor: command.amountMinor,
            utr: command.utr,
            note: command.note,
            attachmentId: command.attachmentId,
            gatewayStatus
          },
          metadata: { command: 'submit_payment_proof' }
        },
        {
          type: followUpType,
          aggregateType: 'settlement_intent',
          aggregateId: command.settlementIntentId,
          groupId: intent.groupId,
          actorId: command.actorId,
          payload: {
            settlementIntentId: command.settlementIntentId,
            proofId,
            reason: isDuplicate ? 'duplicate payment reference' : isPartial ? 'proof amount differs from intent' : undefined
          },
          metadata: { command: 'classify_payment_proof' }
        }
      ]
    });
    return { intent: this.requireIntent(command.settlementIntentId), events };
  }

  async recordGatewayPayment(command: {
    idempotencyKey: string;
    actorId: string;
    status: GatewayPaymentStatus;
  }): Promise<{ intent: SettlementIntentRow; events: DomainEvent[] }> {
    const replayedEvents = await this.ledger.resolveIdempotency({
      aggregateType: 'settlement_intent',
      actorId: command.actorId,
      idempotencyKey: command.idempotencyKey,
      idempotencyPayload: command.status
    });
    if (replayedEvents) {
      return { intent: this.requireIntent(replayedEvents[0].aggregateId), events: replayedEvents };
    }
    if (command.status.status !== 'succeeded') {
      throw new Error(`Gateway payment status ${command.status.status} cannot auto-match a settlement.`);
    }
    const candidate = command.status.settlementIntentId
      ? this.settlements.getIntent(command.status.settlementIntentId)
      : command.status.providerReference
        ? this.settlements.findIntentByProviderReference(command.status.providerReference)
        : undefined;
    if (!candidate) {
      throw new Error('Gateway callback did not identify a known settlement intent.');
    }
    const intent = this.requireIntent(candidate.settlementIntentId);
    const proofId = randomUUID();
    const duplicate = command.status.utr ? this.settlements.findIntentByPaymentReference(command.status.utr) : undefined;
    const isDuplicate = Boolean(duplicate && duplicate.settlementIntentId !== intent.settlementIntentId);
    const expectedVersion = await this.currentVersion(intent.settlementIntentId);
    this.assertTransitionsAllowed(intent, ['submit_proof', isDuplicate ? 'detect_duplicate' : 'auto_match']);

    const events: DomainEvent[] = await this.ledger.appendAndProject({
      aggregateType: 'settlement_intent',
      aggregateId: intent.settlementIntentId,
      expectedVersion,
      idempotencyKey: command.idempotencyKey,
      idempotencyPayload: command.status,
      events: [
        {
          type: 'PaymentProofSubmitted',
          aggregateType: 'settlement_intent',
          aggregateId: intent.settlementIntentId,
          groupId: intent.groupId,
          actorId: command.actorId,
          payload: {
            proofId,
            settlementIntentId: intent.settlementIntentId,
            amountMinor: command.status.amountMinor,
            utr: command.status.utr,
            note: `Gateway status: ${command.status.status}`,
            gatewayStatus: command.status
          },
          metadata: { command: 'record_gateway_payment' }
        },
        {
          type: isDuplicate ? 'DuplicatePaymentReferenceDetected' : 'PaymentAutoMatched',
          aggregateType: 'settlement_intent',
          aggregateId: intent.settlementIntentId,
          groupId: intent.groupId,
          actorId: command.actorId,
          payload: {
            settlementIntentId: intent.settlementIntentId,
            proofId,
            providerReference: command.status.providerReference,
            reason: isDuplicate ? 'duplicate payment reference' : 'provider callback matched payment'
          },
          metadata: { command: 'classify_gateway_payment' }
        }
      ]
    });
    return { intent: this.requireIntent(intent.settlementIntentId), events };
  }

  async confirm(command: SettlementTransitionCommand): Promise<{ intent: SettlementIntentRow; events: DomainEvent[] }> {
    const intent = this.requireIntent(command.settlementIntentId);
    this.assertTransitionsAllowed(intent, ['confirm', 'post_ledger']);
    const events = await this.ledger.appendAndProject({
      aggregateType: 'settlement_intent',
      aggregateId: command.settlementIntentId,
      expectedVersion: command.expectedVersion,
      idempotencyKey: command.idempotencyKey,
      idempotencyPayload: command,
      events: [
        {
          type: 'SettlementConfirmed',
          aggregateType: 'settlement_intent',
          aggregateId: command.settlementIntentId,
          groupId: intent.groupId,
          actorId: command.actorId,
          payload: {
            settlementIntentId: command.settlementIntentId,
            reason: command.reason
          },
          metadata: { command: 'confirm_settlement' }
        },
        {
          type: 'SettlementLedgerPosted',
          aggregateType: 'settlement_intent',
          aggregateId: command.settlementIntentId,
          groupId: intent.groupId,
          actorId: command.actorId,
          payload: {
            settlementIntentId: command.settlementIntentId
          },
          postings: settlementPostings(intent, 'settlement_payment'),
          metadata: { command: 'post_settlement_ledger' }
        }
      ]
    });
    return { intent: this.requireIntent(command.settlementIntentId), events };
  }

  reject(command: SettlementTransitionCommand): Promise<{ intent: SettlementIntentRow; events: DomainEvent[] }> {
    return this.singleTransition(command, 'SettlementRejected', 'reject_settlement');
  }

  dispute(command: SettlementTransitionCommand): Promise<{ intent: SettlementIntentRow; events: DomainEvent[] }> {
    return this.singleTransition(command, 'SettlementDisputed', 'dispute_settlement');
  }

  expire(command: SettlementTransitionCommand): Promise<{ intent: SettlementIntentRow; events: DomainEvent[] }> {
    return this.singleTransition(command, 'SettlementExpired', 'expire_settlement');
  }

  cancel(command: SettlementTransitionCommand): Promise<{ intent: SettlementIntentRow; events: DomainEvent[] }> {
    return this.singleTransition(command, 'SettlementCancelled', 'cancel_settlement');
  }

  async reverse(command: SettlementTransitionCommand): Promise<{ intent: SettlementIntentRow; events: DomainEvent[] }> {
    const intent = this.requireIntent(command.settlementIntentId);
    this.assertTransitionsAllowed(intent, ['reverse']);
    const events = await this.ledger.appendAndProject({
      aggregateType: 'settlement_intent',
      aggregateId: command.settlementIntentId,
      expectedVersion: command.expectedVersion,
      idempotencyKey: command.idempotencyKey,
      idempotencyPayload: command,
      events: [
        {
          type: 'SettlementReversed',
          aggregateType: 'settlement_intent',
          aggregateId: command.settlementIntentId,
          groupId: intent.groupId,
          actorId: command.actorId,
          payload: {
            settlementIntentId: command.settlementIntentId,
            reason: command.reason
          },
          postings: settlementPostings(intent, 'settlement_reversal').map((posting) => ({
            ...posting,
            signedAmountMinor: -posting.signedAmountMinor
          })),
          metadata: { command: 'reverse_settlement' }
        }
      ]
    });
    return { intent: this.requireIntent(command.settlementIntentId), events };
  }

  async refund(command: SettlementTransitionCommand): Promise<{ intent: SettlementIntentRow; events: DomainEvent[] }> {
    const intent = this.requireIntent(command.settlementIntentId);
    this.assertTransitionsAllowed(intent, ['refund']);
    const events = await this.ledger.appendAndProject({
      aggregateType: 'settlement_intent',
      aggregateId: command.settlementIntentId,
      expectedVersion: command.expectedVersion,
      idempotencyKey: command.idempotencyKey,
      idempotencyPayload: command,
      events: [
        {
          type: 'SettlementRefunded',
          aggregateType: 'settlement_intent',
          aggregateId: command.settlementIntentId,
          groupId: intent.groupId,
          actorId: command.actorId,
          payload: {
            settlementIntentId: command.settlementIntentId,
            reason: command.reason
          },
          postings: settlementPostings(intent, 'settlement_refund').map((posting) => ({
            ...posting,
            signedAmountMinor: -posting.signedAmountMinor
          })),
          metadata: { command: 'refund_settlement' }
        }
      ]
    });
    return { intent: this.requireIntent(command.settlementIntentId), events };
  }

  private async singleTransition(
    command: SettlementTransitionCommand,
    type:
      | 'SettlementRejected'
      | 'SettlementDisputed'
      | 'SettlementExpired'
      | 'SettlementCancelled',
    commandName: string
  ): Promise<{ intent: SettlementIntentRow; events: DomainEvent[] }> {
    const intent = this.requireIntent(command.settlementIntentId);
    this.assertTransitionsAllowed(intent, [eventNameForTransition(type)]);
    const events = await this.ledger.appendAndProject({
      aggregateType: 'settlement_intent',
      aggregateId: command.settlementIntentId,
      expectedVersion: command.expectedVersion,
      idempotencyKey: command.idempotencyKey,
      idempotencyPayload: command,
      events: [
        {
          type,
          aggregateType: 'settlement_intent',
          aggregateId: command.settlementIntentId,
          groupId: intent.groupId,
          actorId: command.actorId,
          payload: {
            settlementIntentId: command.settlementIntentId,
            reason: command.reason
          },
          metadata: { command: commandName }
        }
      ]
    });
    return { intent: this.requireIntent(command.settlementIntentId), events };
  }

  private requireIntent(settlementIntentId: string): SettlementIntentRow {
    const intent = this.settlements.getIntent(settlementIntentId);
    if (!intent) {
      throw new Error(`Settlement intent ${settlementIntentId} was not found.`);
    }
    return intent;
  }

  private assertTransitionsAllowed(intent: SettlementIntentRow, events: SettlementEventName[]): void {
    let state = intent.state;
    for (const event of events) {
      state = this.stateMachine.transition(state, event);
    }
  }
}

function eventNameForTransition(
  type: 'SettlementRejected' | 'SettlementDisputed' | 'SettlementExpired' | 'SettlementCancelled'
): SettlementEventName {
  switch (type) {
    case 'SettlementRejected':
      return 'reject';
    case 'SettlementDisputed':
      return 'dispute';
    case 'SettlementExpired':
      return 'expire';
    case 'SettlementCancelled':
      return 'cancel';
  }
}
