import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { BalancedPostingSet } from '@splitsaathi/domain';
import {
  EventStoreEntity,
  IdempotencyRecordEntity,
  LedgerPostingEntity,
  type JsonObject,
  type PostingType
} from '@splitsaathi/db';
import { DataSource, EntityManager, In } from 'typeorm';
import { hashPayload } from './event-store.hashing';
import {
  AppendEventsInput,
  DomainEvent,
  IdempotencyConflictError,
  IdempotencyRecord,
  LedgerEventStorePort,
  OptimisticConcurrencyError,
  ReplayOptions
} from './ledger.types';

function streamKey(aggregateType: string, aggregateId: string): string {
  return `${aggregateType}:${aggregateId}`;
}

function idempotencyScope(input: AppendEventsInput): string {
  return input.aggregateType;
}

function idempotencyActor(input: AppendEventsInput): string {
  return input.events[0]?.actorId ?? 'system';
}

function toJsonObject(value: unknown): JsonObject {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return { value } as JsonObject;
}

function toDomainEvent(row: EventStoreEntity, postings: LedgerPostingEntity[] = []): DomainEvent {
  return {
    eventId: row.id,
    type: row.eventType as DomainEvent['type'],
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    aggregateVersion: row.version,
    globalPosition: Number(row.globalPosition),
    groupId: row.groupId ?? undefined,
    actorId: row.actorUserId ?? undefined,
    occurredAt: row.occurredAt.toISOString(),
    payload: row.payload,
    postings: postings.map((posting) => ({
      participantId: posting.participantId,
      currencyCode: posting.currencyCode,
      signedAmountMinor: Number(posting.signedAmountMinor),
      postingType: posting.postingType,
      sourceType: posting.sourceType,
      sourceId: posting.sourceId
    })),
    metadata: row.metadata
  };
}

function toDbPostingType(postingType: string, signedAmountMinor: number): PostingType {
  if (postingType.startsWith('expense') && postingType.includes('reversal')) {
    return 'reversal';
  }
  if (postingType.startsWith('expense') && signedAmountMinor > 0) {
    return 'expense_payment';
  }
  if (postingType.startsWith('expense')) {
    return 'expense_share';
  }
  if (postingType.startsWith('settlement') && (postingType.includes('reversal') || postingType.includes('refund'))) {
    return 'reversal';
  }
  if (postingType.startsWith('settlement') && signedAmountMinor > 0) {
    return 'settlement_paid';
  }
  if (postingType.startsWith('settlement')) {
    return 'settlement_received';
  }
  if (postingType.includes('obligation_transfer_debit')) {
    return 'obligation_transfer_debit';
  }
  if (postingType.includes('obligation_transfer_credit')) {
    return 'obligation_transfer_credit';
  }
  return 'reversal';
}

@Injectable()
export class PostgresEventStore implements LedgerEventStorePort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async append(input: AppendEventsInput): Promise<DomainEvent[]> {
    if (input.events.length === 0) {
      return [];
    }

    return this.dataSource.transaction((manager) => this.appendInTransaction(manager, input));
  }

  async loadStream(aggregateType: string, aggregateId: string): Promise<DomainEvent[]> {
    const rows = await this.dataSource.getRepository(EventStoreEntity).find({
      where: { aggregateType, aggregateId },
      order: { version: 'ASC' }
    });
    return this.hydrate(rows);
  }

  async replay(options: ReplayOptions = {}): Promise<DomainEvent[]> {
    const query = this.dataSource
      .getRepository(EventStoreEntity)
      .createQueryBuilder('event')
      .orderBy('event.globalPosition', 'ASC');

    if (options.afterGlobalPosition !== undefined) {
      query.andWhere('event.globalPosition > :afterGlobalPosition', {
        afterGlobalPosition: options.afterGlobalPosition
      });
    }
    if (options.aggregateType !== undefined) {
      query.andWhere('event.aggregateType = :aggregateType', { aggregateType: options.aggregateType });
    }
    if (options.aggregateId !== undefined) {
      query.andWhere('event.aggregateId = :aggregateId', { aggregateId: options.aggregateId });
    }
    if (options.groupId !== undefined) {
      query.andWhere('event.groupId = :groupId', { groupId: options.groupId });
    }

    return this.hydrate(await query.getMany());
  }

  async getVersion(aggregateType: string, aggregateId: string): Promise<number> {
    const row = await this.dataSource
      .getRepository(EventStoreEntity)
      .createQueryBuilder('event')
      .select('COALESCE(MAX(event.version), 0)', 'version')
      .where('event.aggregateType = :aggregateType', { aggregateType })
      .andWhere('event.aggregateId = :aggregateId', { aggregateId })
      .getRawOne<{ version: string }>();
    return Number(row?.version ?? 0);
  }

  async getLastGlobalPosition(): Promise<number> {
    const row = await this.dataSource
      .getRepository(EventStoreEntity)
      .createQueryBuilder('event')
      .select('COALESCE(MAX(event.globalPosition), 0)', 'position')
      .getRawOne<{ position: string }>();
    return Number(row?.position ?? 0);
  }

  async getIdempotencyRecord(idempotencyKey: string, scope?: string, actorKey?: string): Promise<IdempotencyRecord | undefined> {
    const record = await this.dataSource.getRepository(IdempotencyRecordEntity).findOne({
      where: scope && actorKey ? { idempotencyKey, scope, actorKey } : { idempotencyKey },
      order: { createdAt: 'DESC' }
    });
    if (!record) {
      return undefined;
    }
    const snapshot = (record.responseSnapshot ?? {}) as { eventIds?: string[] };
    return {
      key: record.idempotencyKey,
      payloadHash: record.requestHash,
      eventIds: snapshot.eventIds ?? [],
      createdAt: record.createdAt.toISOString()
    };
  }

  private async appendInTransaction(manager: EntityManager, input: AppendEventsInput): Promise<DomainEvent[]> {
    const streamId = streamKey(input.aggregateType, input.aggregateId);
    const payloadHash = hashPayload(input.idempotencyPayload ?? input.events);
    const scope = idempotencyScope(input);
    const actorKey = idempotencyActor(input);

    if (input.idempotencyKey) {
      await this.lock(manager, `idempotency:${scope}:${actorKey}:${input.idempotencyKey}`);
      const existing = await this.findIdempotencyRecord(manager, scope, actorKey, input.idempotencyKey);
      if (existing) {
        if (existing.requestHash !== payloadHash) {
          throw new IdempotencyConflictError(input.idempotencyKey);
        }
        const eventIds = ((existing.responseSnapshot ?? {}) as { eventIds?: string[] }).eventIds ?? [];
        return this.loadEventsByIds(manager, eventIds);
      }
    }

    await this.lock(manager, `stream:${streamId}`);
    const actualVersion = await this.getVersionInTransaction(manager, input.aggregateType, input.aggregateId);
    if (input.expectedVersion !== 'any' && actualVersion !== input.expectedVersion) {
      throw new OptimisticConcurrencyError(input.aggregateType, input.aggregateId, input.expectedVersion, actualVersion);
    }

    for (const event of input.events) {
      BalancedPostingSet.create(event.postings ?? []);
      if (event.aggregateType !== input.aggregateType || event.aggregateId !== input.aggregateId) {
        throw new Error('All events in an append batch must target the requested aggregate stream.');
      }
    }

    const storedRows: EventStoreEntity[] = [];
    let previousHash = await this.getLatestEventHash(manager, streamId);

    input.events.forEach((event, index) => {
      const id = randomUUID();
      const eventHash = hashPayload({
        id,
        streamId,
        type: event.type,
        aggregateVersion: actualVersion + index + 1,
        previousHash,
        payload: event.payload,
        postings: event.postings ?? []
      });
      const row = manager.create(EventStoreEntity, {
        id,
        streamId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        groupId: event.groupId ?? null,
        version: actualVersion + index + 1,
        eventType: event.type,
        eventSchemaVersion: 1,
        actorUserId: event.actorId ?? null,
        // The schema keeps this unique; multi-event batches point back through idempotency_records.
        idempotencyKey: index === 0 ? input.idempotencyKey ?? null : null,
        correlationId: randomUUID(),
        causationId: null,
        payload: toJsonObject(event.payload),
        metadata: toJsonObject(event.metadata ?? {}),
        previousHash,
        eventHash
      });
      storedRows.push(row);
      previousHash = eventHash;
    });

    const savedRows = await manager.save(EventStoreEntity, storedRows);
    const postingRows = savedRows.flatMap((row, eventIndex) => {
      const sourceEvent = input.events[eventIndex];
      return (sourceEvent.postings ?? []).map((posting) =>
        manager.create(LedgerPostingEntity, {
          eventId: row.id,
          groupId: sourceEvent.groupId,
          participantId: posting.participantId,
          currencyCode: posting.currencyCode,
          signedAmountMinor: String(posting.signedAmountMinor),
          postingType: toDbPostingType(posting.postingType, posting.signedAmountMinor),
          sourceType: posting.sourceType,
          sourceId: posting.sourceId
        })
      );
    });
    if (postingRows.length > 0) {
      await manager.save(LedgerPostingEntity, postingRows);
    }

    const reloadedRows = await manager.getRepository(EventStoreEntity).find({
      where: { id: In(savedRows.map((row) => row.id)) },
      order: { globalPosition: 'ASC' }
    });

    if (input.idempotencyKey) {
      await manager.save(
        IdempotencyRecordEntity,
        manager.create(IdempotencyRecordEntity, {
          scope,
          actorKey,
          idempotencyKey: input.idempotencyKey,
          requestHash: payloadHash,
          status: 'succeeded',
          responseSnapshot: { eventIds: reloadedRows.map((row) => row.id) },
          expiresAt: null
        })
      );
    }

    const postings = postingRows as LedgerPostingEntity[];
    return reloadedRows.map((row) => toDomainEvent(row, postings.filter((posting) => posting.eventId === row.id)));
  }

  private async lock(manager: EntityManager, lockKey: string): Promise<void> {
    // Advisory locks serialize one aggregate stream or idempotency key without blocking unrelated groups.
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [lockKey]);
  }

  private async getVersionInTransaction(manager: EntityManager, aggregateType: string, aggregateId: string): Promise<number> {
    const row = await manager
      .getRepository(EventStoreEntity)
      .createQueryBuilder('event')
      .select('COALESCE(MAX(event.version), 0)', 'version')
      .where('event.aggregateType = :aggregateType', { aggregateType })
      .andWhere('event.aggregateId = :aggregateId', { aggregateId })
      .getRawOne<{ version: string }>();
    return Number(row?.version ?? 0);
  }

  private async getLatestEventHash(manager: EntityManager, streamId: string): Promise<string | null> {
    const row = await manager.getRepository(EventStoreEntity).findOne({
      where: { streamId },
      order: { version: 'DESC' }
    });
    return row?.eventHash ?? null;
  }

  private async findIdempotencyRecord(
    manager: EntityManager,
    scope: string,
    actorKey: string,
    idempotencyKey: string
  ): Promise<IdempotencyRecordEntity | null> {
    return manager.getRepository(IdempotencyRecordEntity).findOne({
      where: { scope, actorKey, idempotencyKey }
    });
  }

  private async loadEventsByIds(manager: EntityManager, eventIds: string[]): Promise<DomainEvent[]> {
    if (eventIds.length === 0) {
      return [];
    }
    const rows = await manager.getRepository(EventStoreEntity).find({
      where: { id: In(eventIds) },
      order: { globalPosition: 'ASC' }
    });
    return this.hydrate(rows, manager);
  }

  private async hydrate(rows: EventStoreEntity[], manager?: EntityManager): Promise<DomainEvent[]> {
    if (rows.length === 0) {
      return [];
    }
    const eventIds = rows.map((row) => row.id);
    const postingRepository = (manager ?? this.dataSource).getRepository(LedgerPostingEntity);
    const postings = await postingRepository.find({
      where: { eventId: In(eventIds) },
      order: { createdAt: 'ASC' }
    });
    return rows.map((row) => toDomainEvent(row, postings.filter((posting) => posting.eventId === row.id)));
  }
}
