import type { CreateExpenseCommand } from '../expenses';

export interface CreateSplitwiseCsvImportCommand {
  idempotencyKey: string;
  actorId: string;
  groupId: string;
  csv: string;
  participantNameToId: Record<string, string>;
  defaultCurrencyCode?: string;
}

export interface CreateBankCsvImportCommand {
  idempotencyKey: string;
  actorId: string;
  groupId: string;
  csv: string;
  accountParticipantId: string;
  counterpartyParticipantId?: string;
  defaultCurrencyCode?: string;
}

export interface CreateBankAaConsentCommand {
  customerReference: string;
  phoneNumber?: string;
  redirectUrl?: string;
  fromDate: string;
  toDate: string;
}

export interface CreateBankAaImportCommand {
  idempotencyKey: string;
  actorId: string;
  groupId: string;
  consentId: string;
  fromDate: string;
  toDate: string;
  accountParticipantId: string;
  counterpartyParticipantId?: string;
  defaultCurrencyCode?: string;
}

export interface CommitImportCommand {
  idempotencyKey: string;
  actorId: string;
  importJobId: string;
}

export interface ImportItemRow {
  itemId: string;
  importJobId: string;
  status: 'parsed' | 'committed' | 'failed';
  raw: Record<string, string>;
  expenseCommand?: Omit<CreateExpenseCommand, 'idempotencyKey' | 'actorId'>;
  committedExpenseId?: string;
  error?: string;
}

export interface ImportJobRow {
  importJobId: string;
  groupId: string;
  status: 'parsed' | 'committed' | 'failed';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: ImportItemRow[];
}

export interface CreateExportCommand {
  idempotencyKey: string;
  actorId: string;
  groupId: string;
  exportJobId?: string;
  exportType:
    | 'expenses_csv'
    | 'balances_csv'
    | 'full_group_csv'
    | 'group_pdf'
    | 'tally_csv'
    | 'settlement_certificate'
    | 'data_portability_json';
}

export interface ExportJobRow {
  exportJobId: string;
  groupId: string;
  exportType: CreateExportCommand['exportType'];
  status: 'ready';
  contentType: 'text/csv' | 'application/pdf' | 'application/json' | 'text/plain';
  data: string;
  createdBy: string;
  createdAt: string;
}
