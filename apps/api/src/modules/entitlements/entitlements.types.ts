export type CoreLedgerCommand =
  | 'expense.create'
  | 'expense.revise'
  | 'expense.void'
  | 'settlement.intent'
  | 'settlement.proof'
  | 'settlement.confirm'
  | 'import.splitwise'
  | 'export.csv'
  | 'offline.batch';

export type AutomationFeature =
  | 'ocr.receipt_itemizer'
  | 'pdf.statement'
  | 'tally.export'
  | 'bank_import'
  | 'smart_reminders';

export interface EntitlementDecision {
  allowed: boolean;
  cap: number | null;
  reason: string;
}
