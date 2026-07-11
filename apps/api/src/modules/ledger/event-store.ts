import { randomUUID } from 'node:crypto';
import { BalancedPostingSet } from '@splitsaathi/domain';
import {
  AppendEventsInput,
  DomainEvent,
  IdempotencyConflictError,
  IdempotencyRecord,
  LedgerEventStorePort,
  OptimisticConcurrencyError,
  ReplayOptions
} from './ledger.types';
import { hashPayload } from './event-store.hashing';

function streamKey(aggregateType: string, aggregateId: string): string {
  return `${aggregateType}:${aggregateId}`;
}

function idempotencyScope(input: AppendEventsInput): string {
  return input.aggregateType;
}

function idempotencyActor(input: AppendEventsInput): string {
  return input.events[0]?.actorId ?? 'system';
}

function idempotencyKey(input: AppendEventsInput): string {
  return `${idempotencyScope(input)}:${idempotencyActor(input)}:${input.idempotencyKey}`;
}

export class InMemoryEventStore implements LedgerEventStorePort {
  private readonly events: DomainEvent[] = [];
  private readonly streamVersions = new Map<string, number>();
  private readonly idempotencyRecords = new Map<string, IdempotencyRecord>();

  append(input: AppendEventsInput): DomainEvent[] {
    if (input.events.length === 0) {
      return [];
    }

    const key = streamKey(input.aggregateType, input.aggregateId);
    const actualVersion = this.streamVersions.get(key) ?? 0;

    if (input.idempotencyKey) {
      const payloadHash = hashPayload(input.idempotencyPayload ?? input.events);
      const existing = this.idempotencyRecords.get(idempotencyKey(input));
      if (existing) {
        if (existing.payloadHash !== payloadHash) {
          throw new IdempotencyConflictError(input.idempotencyKey);
        }
        return existing.eventIds.map((eventId) => {
          const event = this.events.find((candidate) => candidate.eventId === eventId);
          if (!event) {
            throw new Error(`Idempotency record ${input.idempotencyKey} references missing event ${eventId}.`);
          }
          return event;
        });
      }
    }

    if (input.expectedVersion !== 'any' && actualVersion !== input.expectedVersion) {
      throw new OptimisticConcurrencyError(
        input.aggregateType,
        input.aggregateId,
        input.expectedVersion,
        actualVersion
      );
    }

    for (const event of input.events) {
      BalancedPostingSet.create(event.postings ?? []);
      if (event.aggregateType !== input.aggregateType || event.aggregateId !== input.aggregateId) {
        throw new Error('All events in an append batch must target the requested aggregate stream.');
      }
    }

    const now = new Date().toISOString();
    const storedEvents = input.events.map((event, index) => {
      const aggregateVersion = actualVersion + index + 1;
      const stored: DomainEvent = {
        eventId: randomUUID(),
        type: event.type,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        aggregateVersion,
        globalPosition: this.events.length + index + 1,
        groupId: event.groupId,
        actorId: event.actorId,
        occurredAt: now,
        payload: event.payload,
        postings: event.postings ?? [],
        metadata: event.metadata ?? {}
      };
      return stored;
    });

    this.events.push(...storedEvents);
    this.streamVersions.set(key, actualVersion + storedEvents.length);

    if (input.idempotencyKey) {
      this.idempotencyRecords.set(idempotencyKey(input), {
        key: input.idempotencyKey,
        payloadHash: hashPayload(input.idempotencyPayload ?? input.events),
        eventIds: storedEvents.map((event) => event.eventId),
        createdAt: now
      });
    }

    return storedEvents;
  }

  loadStream(aggregateType: string, aggregateId: string): DomainEvent[] {
    return this.events.filter(
      (event) => event.aggregateType === aggregateType && event.aggregateId === aggregateId
    );
  }

  replay(options: ReplayOptions = {}): DomainEvent[] {
    return this.events.filter((event) => {
      if (options.afterGlobalPosition !== undefined && event.globalPosition <= options.afterGlobalPosition) {
        return false;
      }
      if (options.aggregateType !== undefined && event.aggregateType !== options.aggregateType) {
        return false;
      }
      if (options.aggregateId !== undefined && event.aggregateId !== options.aggregateId) {
        return false;
      }
      if (options.groupId !== undefined && event.groupId !== options.groupId) {
        return false;
      }
      return true;
    });
  }

  getVersion(aggregateType: string, aggregateId: string): number {
    return this.streamVersions.get(streamKey(aggregateType, aggregateId)) ?? 0;
  }

  getLastGlobalPosition(): number {
    return this.events.at(-1)?.globalPosition ?? 0;
  }

  getIdempotencyRecord(idempotencyKey: string, scope?: string, actorKey?: string): IdempotencyRecord | undefined {
    const key = scope && actorKey ? `${scope}:${actorKey}:${idempotencyKey}` : idempotencyKey;
    return this.idempotencyRecords.get(key);
  }

  clear(): void {
    this.events.length = 0;
    this.streamVersions.clear();
    this.idempotencyRecords.clear();
  }
}
