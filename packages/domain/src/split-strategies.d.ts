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
export declare class EqualSplitStrategy implements SplitStrategy {
    private readonly allocator;
    calculate(totalMinor: number, participants: SplitParticipant[]): SplitResult[];
}
export declare class ExactAmountSplitStrategy implements SplitStrategy {
    calculate(totalMinor: number, participants: SplitParticipant[]): SplitResult[];
}
export declare class WeightedShareSplitStrategy implements SplitStrategy {
    private readonly allocator;
    calculate(totalMinor: number, participants: SplitParticipant[]): SplitResult[];
}
