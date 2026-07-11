import type { DomainEvent } from './ledger.types';
import type { Projector } from './projection-runner';

export interface ActivityFeedRow {
  eventId: string;
  groupId?: string;
  type: string;
  actorId?: string;
  occurredAt: string;
  title: string;
  searchText: string;
  globalPosition: number;
}

function eventTitle(event: DomainEvent): string {
  const payload = event.payload as Record<string, unknown>;
  if (event.type.startsWith('Expense')) {
    return `${event.type}: ${String(payload.description ?? payload.expenseId ?? event.aggregateId)}`;
  }
  if (event.type.startsWith('Settlement') || event.type.includes('Payment') || event.type.includes('Upi')) {
    return `${event.type}: ${String(payload.settlementIntentId ?? event.aggregateId)}`;
  }
  return `${event.type}: ${event.aggregateId}`;
}

export class ActivityProjector implements Projector {
  readonly name = 'activity_feed_projection';

  private readonly rows: ActivityFeedRow[] = [];

  apply(event: DomainEvent): void {
    const title = eventTitle(event);
    this.rows.push({
      eventId: event.eventId,
      groupId: event.groupId,
      type: event.type,
      actorId: event.actorId,
      occurredAt: event.occurredAt,
      title,
      searchText: `${title} ${JSON.stringify(event.payload)}`.toLowerCase(),
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
  }
}
