import { EqualSplitStrategy, ExactAmountSplitStrategy, WeightedShareSplitStrategy } from './split-strategies';

describe('split strategies', () => {
  it('splits equally with visible residuals', () => {
    const result = new EqualSplitStrategy().calculate(100, [
      { participantId: 'a', shareType: 'equal' },
      { participantId: 'b', shareType: 'equal' },
      { participantId: 'c', shareType: 'equal' }
    ]);

    expect(result.reduce((sum, row) => sum + row.amountMinor, 0)).toBe(100);
    expect(result.some((row) => row.roundingDeltaMinor !== 0)).toBe(true);
  });

  it('rejects exact splits that do not match the total', () => {
    expect(() =>
      new ExactAmountSplitStrategy().calculate(100, [
        { participantId: 'a', shareType: 'exact', amountMinor: 40 },
        { participantId: 'b', shareType: 'exact', amountMinor: 40 }
      ])
    ).toThrow(/Exact split/);
  });

  it('supports weighted fractional shares', () => {
    const result = new WeightedShareSplitStrategy().calculate(300, [
      { participantId: 'a', shareType: 'weight', weightNumerator: 2, weightDenominator: 1 },
      { participantId: 'b', shareType: 'weight', weightNumerator: 1, weightDenominator: 1 }
    ]);

    expect(result).toEqual([
      { participantId: 'a', amountMinor: 200, roundingDeltaMinor: 0 },
      { participantId: 'b', amountMinor: 100, roundingDeltaMinor: 0 }
    ]);
  });
});
