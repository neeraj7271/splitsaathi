import {
  EqualSplitStrategy,
  ExactAmountSplitStrategy,
  RoundingAllocator,
  WeightedShareSplitStrategy
} from '@splitsaathi/domain';
import type { BillAdjustmentRow, ExpenseLineItemRow, ExpenseShareInput, ExpenseAllocationResult } from './expense.types';

function requireIntegerAmount(amountMinor: number, label: string): void {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`${label} must use integer minor units.`);
  }
}

function participantIdsFromShares(shares: ExpenseShareInput[]): string[] {
  const ids = [...new Set(shares.map((share) => share.participantId))];
  if (ids.length === 0) {
    throw new Error('At least one participant share is required.');
  }
  return ids;
}

export class ExpenseAllocationService {
  private readonly equal = new EqualSplitStrategy();
  private readonly exact = new ExactAmountSplitStrategy();
  private readonly weighted = new WeightedShareSplitStrategy();
  private readonly roundingAllocator = new RoundingAllocator();

  calculate(
    totalAmountMinor: number,
    currencyCode: string,
    shares: ExpenseShareInput[],
    lineItems: ExpenseLineItemRow[] = [],
    billAdjustments: BillAdjustmentRow[] = []
  ): ExpenseAllocationResult {
    requireIntegerAmount(totalAmountMinor, 'Expense total');

    const usesItemized = shares.some((share) => share.shareType === 'itemized') || lineItems.length > 0;
    if (usesItemized) {
      return this.calculateItemized(totalAmountMinor, currencyCode, shares, lineItems, billAdjustments);
    }

    const splitTypes = new Set(shares.map((share) => share.shareType));
    const results =
      splitTypes.size === 1 && splitTypes.has('equal')
        ? this.equal.calculate(totalAmountMinor, shares)
        : splitTypes.size === 1 && splitTypes.has('exact')
          ? this.exact.calculate(totalAmountMinor, shares)
          : [...splitTypes].every((type) => type === 'weight' || type === 'percent')
            ? this.weighted.calculate(
                totalAmountMinor,
                shares.map((share) => ({
                  ...share,
                  shareType: 'weight',
                  weightNumerator: share.weightNumerator ?? share.amountMinor ?? 1,
                  weightDenominator: share.weightDenominator ?? 1
                }))
              )
            : this.exact.calculate(totalAmountMinor, shares);

    return {
      shares: results.map((result) => ({
        participantId: result.participantId,
        amountMinor: result.amountMinor,
        shareType: shares.find((share) => share.participantId === result.participantId)?.shareType ?? 'exact',
        roundingDeltaMinor: result.roundingDeltaMinor
      })),
      roundingResiduals: results
        .filter((result) => result.roundingDeltaMinor !== 0)
        .map((result) => ({
          participantId: result.participantId,
          currencyCode,
          residualMinor: result.roundingDeltaMinor,
          reason: 'deterministic split rounding'
        }))
    };
  }

  private calculateItemized(
    totalAmountMinor: number,
    currencyCode: string,
    shares: ExpenseShareInput[],
    lineItems: ExpenseLineItemRow[],
    billAdjustments: BillAdjustmentRow[]
  ): ExpenseAllocationResult {
    if (lineItems.length === 0) {
      throw new Error('Itemized splits require at least one line item.');
    }

    const participantIds = participantIdsFromShares(shares);
    const shareTotals = new Map<string, number>(participantIds.map((participantId) => [participantId, 0]));
    const residuals: ExpenseAllocationResult['roundingResiduals'] = [];

    for (const item of lineItems) {
      requireIntegerAmount(item.amountMinor, `Line item ${item.label}`);
      const allocations = this.roundingAllocator.allocate(
        item.amountMinor,
        item.participantIds.map((participantId) => ({ id: participantId, weightNumerator: 1, weightDenominator: 1 }))
      );
      for (const allocation of allocations) {
        shareTotals.set(allocation.id, (shareTotals.get(allocation.id) ?? 0) + allocation.amountMinor);
        if (allocation.residualMinor !== 0) {
          residuals.push({
            participantId: allocation.id,
            currencyCode,
            residualMinor: allocation.residualMinor,
            reason: `rounding on line item ${item.label}`
          });
        }
      }
    }

    for (const adjustment of billAdjustments) {
      requireIntegerAmount(adjustment.amountMinor, `Adjustment ${adjustment.label}`);
      const basisIds = participantIds.filter((participantId) => (shareTotals.get(participantId) ?? 0) !== 0);
      const idsForAdjustment = basisIds.length > 0 ? basisIds : participantIds;
      const allocations =
        adjustment.allocationBasis === 'equal'
          ? this.roundingAllocator.allocate(
              adjustment.amountMinor,
              idsForAdjustment.map((participantId) => ({
                id: participantId,
                weightNumerator: 1,
                weightDenominator: 1
              }))
            )
          : this.roundingAllocator.allocate(
              adjustment.amountMinor,
              idsForAdjustment.map((participantId) => ({
                id: participantId,
                weightNumerator: Math.max(1, Math.abs(shareTotals.get(participantId) ?? 0)),
                weightDenominator: 1
              }))
            );

      for (const allocation of allocations) {
        shareTotals.set(allocation.id, (shareTotals.get(allocation.id) ?? 0) + allocation.amountMinor);
        if (allocation.residualMinor !== 0) {
          residuals.push({
            participantId: allocation.id,
            currencyCode,
            residualMinor: allocation.residualMinor,
            reason: `rounding on adjustment ${adjustment.label}`
          });
        }
      }
    }

    const calculatedTotal = [...shareTotals.values()].reduce((sum, amountMinor) => sum + amountMinor, 0);
    if (calculatedTotal !== totalAmountMinor) {
      throw new Error(`Itemized split must sum to ${totalAmountMinor}; received ${calculatedTotal}.`);
    }

    return {
      shares: participantIds.map((participantId) => ({
        participantId,
        amountMinor: shareTotals.get(participantId) ?? 0,
        shareType: 'itemized',
        roundingDeltaMinor: residuals
          .filter((residual) => residual.participantId === participantId)
          .reduce((sum, residual) => sum + residual.residualMinor, 0)
      })),
      roundingResiduals: residuals
    };
  }
}
