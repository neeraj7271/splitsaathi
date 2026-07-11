import { Injectable } from '@nestjs/common';
import {
  ObligationTransferInput,
  ObligationTransferPort,
  ObligationTransferResult
} from '../ports/obligation-transfer.port';

@Injectable()
export class NoopObligationTransferProvider implements ObligationTransferPort {
  async requestTransfer(_input: ObligationTransferInput): Promise<ObligationTransferResult> {
    return {
      status: 'requires_ledger_module',
      message: 'Obligation transfer was validated by Groups but requires the Ledger module to post financial events.'
    };
  }
}
