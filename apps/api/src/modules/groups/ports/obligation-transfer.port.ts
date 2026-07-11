import { ObligationTransferDto } from '../dto/obligation-transfer.dto';

export const OBLIGATION_TRANSFER_PORT = Symbol('OBLIGATION_TRANSFER_PORT');

export interface ObligationTransferInput extends ObligationTransferDto {
  groupId: string;
  requestedByUserId: string;
}

export interface ObligationTransferResult {
  status: 'accepted' | 'requires_ledger_module';
  message: string;
}

export interface ObligationTransferPort {
  requestTransfer(input: ObligationTransferInput): Promise<ObligationTransferResult>;
}
