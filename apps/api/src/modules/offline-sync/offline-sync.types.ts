import type {
  CreateExpenseCommand,
  ReviseExpenseCommand,
  VoidExpenseCommand
} from '../expenses';
import type {
  CommitImportCommand,
  CreateExportCommand,
  CreateSplitwiseCsvImportCommand
} from '../imports-exports';
import type { CreateRecurringScheduleCommand, GenerateRecurringExpensesCommand } from '../recurring';
import type {
  CreateSettlementIntentCommand,
  MarkUpiOpenedCommand,
  SettlementTransitionCommand,
  SubmitPaymentProofCommand
} from '../settlements';

export type OfflineCommandType =
  | 'expense.create'
  | 'expense.revise'
  | 'expense.void'
  | 'settlement.createIntent'
  | 'settlement.upiOpened'
  | 'settlement.submitProof'
  | 'settlement.confirm'
  | 'settlement.reject'
  | 'settlement.dispute'
  | 'settlement.reverse'
  | 'settlement.refund'
  | 'import.splitwiseCsv'
  | 'import.commit'
  | 'export.create'
  | 'recurring.createSchedule'
  | 'recurring.generateDue';

export type OfflineCommandPayload =
  | CreateExpenseCommand
  | ReviseExpenseCommand
  | VoidExpenseCommand
  | CreateSettlementIntentCommand
  | MarkUpiOpenedCommand
  | SubmitPaymentProofCommand
  | SettlementTransitionCommand
  | CreateSplitwiseCsvImportCommand
  | CommitImportCommand
  | CreateExportCommand
  | CreateRecurringScheduleCommand
  | GenerateRecurringExpensesCommand;

export interface OfflineCommand {
  clientMutationId: string;
  idempotencyKey: string;
  commandType: OfflineCommandType;
  payload: OfflineCommandPayload;
}

export interface OfflineCommandResult {
  clientMutationId: string;
  commandType: OfflineCommandType;
  status: 'accepted' | 'conflict' | 'failed';
  eventIds: string[];
  globalPositions: number[];
  error?: string;
}

export interface OfflineCommandBatchRequest {
  commands: OfflineCommand[];
  cursor?: number;
}

export interface OfflineCommandBatchResponse {
  results: OfflineCommandResult[];
  events: unknown[];
  nextCursor: number;
}
