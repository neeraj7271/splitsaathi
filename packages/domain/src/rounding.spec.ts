import fc from 'fast-check';
import { RoundingAllocator } from './rounding';

describe('RoundingAllocator', () => {
  it('always allocates the exact total using deterministic integer minor units', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 12 }),
        (totalMinor, weights) => {
          const allocator = new RoundingAllocator();
          const result = allocator.allocate(
            totalMinor,
            weights.map((weight, index) => ({
              id: `p-${index}`,
              weightNumerator: weight,
              weightDenominator: 1
            }))
          );

          expect(result.reduce((sum, row) => sum + row.amountMinor, 0)).toBe(totalMinor);
          expect(result.every((row) => Number.isInteger(row.amountMinor))).toBe(true);
        }
      )
    );
  });

  it('is stable for the same participant ids and weights', () => {
    const allocator = new RoundingAllocator();
    const inputs = [
      { id: 'a', weightNumerator: 1, weightDenominator: 3 },
      { id: 'b', weightNumerator: 1, weightDenominator: 3 },
      { id: 'c', weightNumerator: 1, weightDenominator: 3 }
    ];

    expect(allocator.allocate(100, inputs)).toEqual(allocator.allocate(100, inputs));
  });

  it('reconciles equal split of ₹100.00 across 3 people (residual handled)', () => {
    const allocator = new RoundingAllocator();
    const totalMinor = 10000; // ₹100.00
    const result = allocator.allocate(totalMinor, [
      { id: 'alice', weightNumerator: 1, weightDenominator: 1 },
      { id: 'bob', weightNumerator: 1, weightDenominator: 1 },
      { id: 'carol', weightNumerator: 1, weightDenominator: 1 }
    ]);

    expect(result.reduce((sum, row) => sum + row.amountMinor, 0)).toBe(totalMinor);
    expect(result.every((row) => Number.isInteger(row.amountMinor))).toBe(true);
    // 10000 / 3 → 3333 + 3333 + 3334 (one paisa residual)
    const amounts = result.map((row) => row.amountMinor).sort((a, b) => a - b);
    expect(amounts).toEqual([3333, 3333, 3334]);
    expect(result.reduce((sum, row) => sum + row.residualMinor, 0)).toBe(1);
  });
});
