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

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export class RoundingAllocator {
  allocate(totalMinor: number, inputs: WeightedAllocationInput[]): AllocationResult[] {
    if (!Number.isInteger(totalMinor)) {
      throw new Error('Total must be integer minor units.');
    }
    if (inputs.length === 0) {
      throw new Error('At least one allocation input is required.');
    }

    const normalized = inputs.map((input) => {
      if (input.weightNumerator <= 0 || input.weightDenominator <= 0) {
        throw new Error('Weights must be positive rational values.');
      }
      return {
        ...input,
        weight: input.weightNumerator / input.weightDenominator
      };
    });

    const totalWeight = normalized.reduce((sum, input) => sum + input.weight, 0);
    const sign = totalMinor < 0 ? -1 : 1;
    const absoluteTotal = Math.abs(totalMinor);

    const base = normalized.map((input) => {
      const exact = (absoluteTotal * input.weight) / totalWeight;
      const floored = Math.floor(exact);
      return {
        id: input.id,
        floored,
        fraction: exact - floored,
        hash: stableHash(input.id)
      };
    });

    let remainder = absoluteTotal - base.reduce((sum, row) => sum + row.floored, 0);
    const sorted = [...base].sort((left, right) => {
      if (right.fraction !== left.fraction) return right.fraction - left.fraction;
      return left.hash - right.hash;
    });

    const extras = new Map<string, number>();
    for (const row of sorted) {
      if (remainder <= 0) break;
      extras.set(row.id, (extras.get(row.id) ?? 0) + 1);
      remainder -= 1;
    }

    return base.map((row) => {
      const allocatedAbsolute = row.floored + (extras.get(row.id) ?? 0);
      const amountMinor = sign * allocatedAbsolute;
      // Store the visible residual as the deterministic rounding delta from floor allocation.
      const residualMinor = sign * (allocatedAbsolute - row.floored);
      return { id: row.id, amountMinor, residualMinor };
    });
  }
}
