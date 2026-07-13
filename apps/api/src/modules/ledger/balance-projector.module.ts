import { Module } from '@nestjs/common';
import { BalanceProjector } from './balance.projector';

/**
 * Lightweight shared module that owns the BalanceProjector singleton.
 * Import this in any module that needs to read balances without depending
 * on the full FinancialLedgerModule (which would create circular deps).
 */
@Module({
  providers: [BalanceProjector],
  exports: [BalanceProjector]
})
export class BalanceProjectorModule {}
