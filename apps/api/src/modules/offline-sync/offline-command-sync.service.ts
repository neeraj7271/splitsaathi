import { IdempotencyConflictError, LedgerService, OptimisticConcurrencyError, type DomainEvent } from '../ledger';
import { ExpenseCommandService, type CreateExpenseCommand, type ReviseExpenseCommand, type VoidExpenseCommand } from '../expenses';
import {
  CsvExportService,
  SplitwiseImportService,
  type CommitImportCommand,
  type CreateExportCommand,
  type CreateSplitwiseCsvImportCommand
} from '../imports-exports';
import { RecurringExpenseService, type CreateRecurringScheduleCommand, type GenerateRecurringExpensesCommand } from '../recurring';
import {
  SettlementCommandService,
  type CreateSettlementIntentCommand,
  type MarkUpiOpenedCommand,
  type SettlementTransitionCommand,
  type SubmitPaymentProofCommand
} from '../settlements';
import type { OfflineCommand, OfflineCommandBatchRequest, OfflineCommandBatchResponse, OfflineCommandResult } from './offline-sync.types';

export class OfflineCommandSyncService {
  constructor(
    private readonly ledger: LedgerService,
    private readonly expenses: ExpenseCommandService,
    private readonly settlements: SettlementCommandService,
    private readonly imports: SplitwiseImportService,
    private readonly exportsService: CsvExportService,
    private readonly recurring: RecurringExpenseService
  ) {}

  async executeBatch(request: OfflineCommandBatchRequest): Promise<OfflineCommandBatchResponse> {
    const results: OfflineCommandResult[] = [];
    for (const command of request.commands) {
      results.push(await this.executeOne(command));
    }
    const cursor = request.cursor ?? 0;
    const events = await this.ledger.replay({ afterGlobalPosition: cursor });
    return {
      results,
      events,
      nextCursor: await this.ledger.getLastGlobalPosition()
    };
  }

  async sync(cursor = 0): Promise<{ events: DomainEvent[]; nextCursor: number }> {
    return {
      events: await this.ledger.replay({ afterGlobalPosition: cursor }),
      nextCursor: await this.ledger.getLastGlobalPosition()
    };
  }

  private async executeOne(command: OfflineCommand): Promise<OfflineCommandResult> {
    try {
      const events = await this.route(command);
      return {
        clientMutationId: command.clientMutationId,
        commandType: command.commandType,
        status: 'accepted',
        eventIds: events.map((event) => event.eventId),
        globalPositions: events.map((event) => event.globalPosition)
      };
    } catch (error) {
      const conflict = error instanceof OptimisticConcurrencyError || error instanceof IdempotencyConflictError;
      return {
        clientMutationId: command.clientMutationId,
        commandType: command.commandType,
        status: conflict ? 'conflict' : 'failed',
        eventIds: [],
        globalPositions: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private route(command: OfflineCommand): Promise<DomainEvent[]> {
    switch (command.commandType) {
      case 'expense.create':
        return this.expenses.createExpense(command.payload as CreateExpenseCommand).then((result) => result.events);
      case 'expense.revise':
        return this.expenses.reviseExpense(command.payload as ReviseExpenseCommand).then((result) => result.events);
      case 'expense.void':
        return this.expenses.voidExpense(command.payload as VoidExpenseCommand).then((result) => result.events);
      case 'settlement.createIntent':
        return this.settlements.createIntent(command.payload as CreateSettlementIntentCommand).then((result) => result.events);
      case 'settlement.upiOpened':
        return this.settlements.markUpiOpened(command.payload as MarkUpiOpenedCommand).then((result) => result.events);
      case 'settlement.submitProof':
        return this.settlements.submitProof(command.payload as SubmitPaymentProofCommand).then((result) => result.events);
      case 'settlement.confirm':
        return this.settlements.confirm(command.payload as SettlementTransitionCommand).then((result) => result.events);
      case 'settlement.reject':
        return this.settlements.reject(command.payload as SettlementTransitionCommand).then((result) => result.events);
      case 'settlement.dispute':
        return this.settlements.dispute(command.payload as SettlementTransitionCommand).then((result) => result.events);
      case 'settlement.reverse':
        return this.settlements.reverse(command.payload as SettlementTransitionCommand).then((result) => result.events);
      case 'settlement.refund':
        return this.settlements.refund(command.payload as SettlementTransitionCommand).then((result) => result.events);
      case 'import.splitwiseCsv':
        return this.imports.createImport(command.payload as CreateSplitwiseCsvImportCommand).then((result) => result.events);
      case 'import.commit':
        return this.imports.commitImport(command.payload as CommitImportCommand).then((result) => result.events);
      case 'export.create':
        return this.exportsService.createExport(command.payload as CreateExportCommand).then((result) => result.events);
      case 'recurring.createSchedule':
        return this.recurring.createSchedule(command.payload as CreateRecurringScheduleCommand).then((result) => result.events);
      case 'recurring.generateDue':
        return this.recurring.generateDue(command.payload as GenerateRecurringExpensesCommand).then((result) => result.events);
      default:
        throw new Error(`Unsupported offline command type ${(command as OfflineCommand).commandType}.`);
    }
  }
}
