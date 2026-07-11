export interface WeightedAllocationInput {
    id: string;
    weightNumerator: number;
    weightDenominator: number;
}
export interface AllocationResult {
    id: string;
    amountMinor: number;
    residualMinor: number;
}
export declare class RoundingAllocator {
    allocate(totalMinor: number, inputs: WeightedAllocationInput[]): AllocationResult[];
}
