import type { LedgerPostingInput } from '@splitsaathi/domain';

export const LEDGER_EVENT_STORE = 'LEDGER_EVENT_STORE';

export type DomainEventType =
  | 'ExpenseCreated'
  | 'ExpenseAdjusted'
  | 'ExpenseVoided'
  | 'SettlementIntentCreated'
  | 'CashSettlementRecorded'
  | 'UpiIntentGenerated'
  | 'UpiAppOpened'
  | 'PaymentProofSubmitted'
  | 'PaymentAutoMatched'
  | 'ReceiverConfirmationRequested'
  | 'SettlementConfirmed'
  | 'SettlementLedgerPosted'
  | 'SettlementRejected'
  | 'SettlementDisputed'
  | 'SettlementReversed'
  | 'SettlementRefunded'
  | 'PartialPaymentDetected'
  | 'DuplicatePaymentReferenceDetected'
  | 'SettlementExpired'
  | 'SettlementCancelled'
  | 'ImportJobCreated'
  | 'ImportItemCommitted'
  | 'ExportJobCreated'
  | 'RecurringScheduleCreated'
  | 'RecurringExpenseGenerated';

export interface DomainEvent<TPayload = unknown> {
  eventId: string;
  type: DomainEventType;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  globalPosition: number;
  groupId?: string;
  actorId?: string;
  occurredAt: string;
  payload: TPayload;
  postings: LedgerPostingInput[];
  metadata: Record<string, unknown>;
}

export interface NewDomainEvent<TPayload = unknown> {
  type: DomainEventType;
  aggregateType: string;
  aggregateId: string;
  groupId?: string;
  actorId?: string;
  payload: TPayload;
  postings?: LedgerPostingInput[];
  metadata?: Record<string, unknown>;
}

export interface AppendEventsInput {
  aggregateType: string;
  aggregateId: string;
  expectedVersion: number | 'any';
  events: NewDomainEvent[];
  idempotencyKey?: string;
  idempotencyPayload?: unknown;
}

export interface ReplayOptions {
  afterGlobalPosition?: number;
  aggregateType?: string;
  aggregateId?: string;
  groupId?: string;
}

export interface IdempotencyRecord {
  key: string;
  payloadHash: string;
  eventIds: string[];
  createdAt: string;
}

export type MaybePromise<T> = T | Promise<T>;

export interface LedgerEventStorePort {
  append(input: AppendEventsInput): MaybePromise<DomainEvent[]>;
  loadStream(aggregateType: string, aggregateId: string): MaybePromise<DomainEvent[]>;
  replay(options?: ReplayOptions): MaybePromise<DomainEvent[]>;
  getVersion(aggregateType: string, aggregateId: string): MaybePromise<number>;
  getLastGlobalPosition(): MaybePromise<number>;
  getIdempotencyRecord(idempotencyKey: string, scope?: string, actorKey?: string): MaybePromise<IdempotencyRecord | undefined>;
}

export class OptimisticConcurrencyError extends Error {
  constructor(
    public readonly aggregateType: string,
    public readonly aggregateId: string,
    public readonly expectedVersion: number | 'any',
    public readonly actualVersion: number
  ) {
    super(
      `Expected ${aggregateType}/${aggregateId} version ${expectedVersion}, but current version is ${actualVersion}.`
    );
  }
}

export class IdempotencyConflictError extends Error {
  constructor(public readonly idempotencyKey: string) {
    super(`Idempotency key ${idempotencyKey} was already used with a different payload.`);
  }
}
