import { Injectable, OnModuleInit } from '@nestjs/common';
import type { AppendEventsInput, DomainEvent, ReplayOptions } from './ledger.types';
import { IdempotencyConflictError } from './ledger.types';
import type { LedgerEventStorePort } from './ledger.types';
import { hashPayload } from './event-store.hashing';
import { ProjectionRunner } from './projection-runner';

@Injectable()
export class LedgerService implements OnModuleInit {
  constructor(
    private readonly eventStore: LedgerEventStorePort,
    private readonly projectionRunner: ProjectionRunner
  ) {}

  async onModuleInit(): Promise<void> {
    if ((await this.eventStore.getLastGlobalPosition()) > 0) {
      await this.rebuildProjections();
    }
  }

  async appendAndProject(input: AppendEventsInput): Promise<DomainEvent[]> {
    const beforeLastPosition = await this.eventStore.getLastGlobalPosition();
    const events = await this.eventStore.append(input);
    const newEvents = events.filter((event) => event.globalPosition > beforeLastPosition);
    if (newEvents.length > 0) {
      this.projectionRunner.apply(newEvents);
    }
    return events;
  }

  async replay(options: ReplayOptions = {}): Promise<DomainEvent[]> {
    return this.eventStore.replay(options);
  }

  async rebuildProjections(): Promise<void> {
    this.projectionRunner.rebuild(await this.eventStore.replay());
  }

  async getVersion(aggregateType: string, aggregateId: string): Promise<number> {
    return this.eventStore.getVersion(aggregateType, aggregateId);
  }

  async getLastGlobalPosition(): Promise<number> {
    return this.eventStore.getLastGlobalPosition();
  }

  async resolveIdempotency(input: {
    aggregateType: string;
    actorId: string;
    idempotencyKey: string;
    idempotencyPayload: unknown;
  }): Promise<DomainEvent[] | undefined> {
    const record = await this.eventStore.getIdempotencyRecord(
      input.idempotencyKey,
      input.aggregateType,
      input.actorId
    );
    if (!record) {
      return undefined;
    }
    if (record.payloadHash !== hashPayload(input.idempotencyPayload)) {
      throw new IdempotencyConflictError(input.idempotencyKey);
    }
    const events = await this.eventStore.replay();
    return record.eventIds.map((eventId) => {
      const event = events.find((candidate) => candidate.eventId === eventId);
      if (!event) {
        throw new Error(`Idempotency record ${input.idempotencyKey} references missing event ${eventId}.`);
      }
      return event;
    });
  }
}
