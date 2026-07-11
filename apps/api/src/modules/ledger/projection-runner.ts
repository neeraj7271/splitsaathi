import type { DomainEvent } from './ledger.types';

export interface Projector {
  readonly name: string;
  apply(event: DomainEvent): void;
  reset(): void;
}

export class ProjectionRunner {
  constructor(private readonly projectors: Projector[]) {}

  apply(events: DomainEvent[]): void {
    for (const event of events) {
      for (const projector of this.projectors) {
        projector.apply(event);
      }
    }
  }

  rebuild(events: DomainEvent[]): void {
    for (const projector of this.projectors) {
      projector.reset();
    }
    this.apply(events);
  }
}
