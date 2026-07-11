import { RoundingAllocator } from './rounding';

export interface SplitParticipant {
  participantId: string;
  shareType: 'equal' | 'exact' | 'percent' | 'weight' | 'itemized';
  amountMinor?: number;
  weightNumerator?: number;
  weightDenominator?: number;
}

export interface SplitResult {
  participantId: string;
  amountMinor: number;
  roundingDeltaMinor: number;
}

export interface SplitStrategy {
  calculate(totalMinor: number, participants: SplitParticipant[]): SplitResult[];
}

export class EqualSplitStrategy implements SplitStrategy {
  private readonly allocator = new RoundingAllocator();

  calculate(totalMinor: number, participants: SplitParticipant[]): SplitResult[] {
    return this.allocator
      .allocate(
        totalMinor,
        participants.map((participant) => ({
          id: participant.participantId,
          weightNumerator: 1,
          weightDenominator: 1
        }))
      )
      .map((allocation) => ({
        participantId: allocation.id,
        amountMinor: allocation.amountMinor,
        roundingDeltaMinor: allocation.residualMinor
      }));
  }
}

export class ExactAmountSplitStrategy implements SplitStrategy {
  calculate(totalMinor: number, participants: SplitParticipant[]): SplitResult[] {
    const rows = participants.map((participant) => ({
      participantId: participant.participantId,
      amountMinor: participant.amountMinor ?? 0,
      roundingDeltaMinor: 0
    }));
    const sum = rows.reduce((value, row) => value + row.amountMinor, 0);
    if (sum !== totalMinor) {
      throw new Error(`Exact split must sum to ${totalMinor}; received ${sum}.`);
    }
    return rows;
  }
}

export class WeightedShareSplitStrategy implements SplitStrategy {
  private readonly allocator = new RoundingAllocator();

  calculate(totalMinor: number, participants: SplitParticipant[]): SplitResult[] {
    return this.allocator
      .allocate(
        totalMinor,
        participants.map((participant) => ({
          id: participant.participantId,
          weightNumerator: participant.weightNumerator ?? 1,
          weightDenominator: participant.weightDenominator ?? 1
        }))
      )
      .map((allocation) => ({
        participantId: allocation.id,
        amountMinor: allocation.amountMinor,
        roundingDeltaMinor: allocation.residualMinor
      }));
  }
}
