import { randomUUID } from 'node:crypto';
import { LedgerService, type DomainEvent } from '../ledger';
import { ExpenseCommandService } from '../expenses';
import { decimalToMinor, parseCsv } from './csv';
import { ImportsExportsProjector } from './imports-exports.projector';
import type {
  CommitImportCommand,
  CreateBankCsvImportCommand,
  CreateSplitwiseCsvImportCommand,
  ImportItemRow,
  ImportJobRow
} from './imports-exports.types';

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_');
}

function readCell(row: Record<string, string>, names: string[], fallback = ''): string {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== '') {
      return row[name];
    }
  }
  return fallback;
}

export class SplitwiseImportService {
  constructor(
    private readonly ledger: LedgerService,
    private readonly importsExports: ImportsExportsProjector,
    private readonly expenses: ExpenseCommandService
  ) {}

  async createImport(command: CreateSplitwiseCsvImportCommand): Promise<{ job: ImportJobRow; events: DomainEvent[] }> {
    const rows = parseCsv(command.csv);
    if (rows.length < 2) {
      throw new Error('Import CSV requires a header and at least one data row.');
    }
    const headers = rows[0].map(normalizeHeader);
    const importJobId = randomUUID();
    const items = rows.slice(1).map((cells, index) => this.rowToItem(importJobId, command, headers, cells, index));

    const events = await this.ledger.appendAndProject({
      aggregateType: 'import_job',
      aggregateId: importJobId,
      expectedVersion: 0,
      idempotencyKey: command.idempotencyKey,
      idempotencyPayload: command,
      events: [
        {
          type: 'ImportJobCreated',
          aggregateType: 'import_job',
          aggregateId: importJobId,
          groupId: command.groupId,
          actorId: command.actorId,
          payload: {
            importJobId,
            groupId: command.groupId,
            items
          },
          metadata: { command: 'create_splitwise_csv_import' }
        }
      ]
    });

    const job = this.importsExports.getImportJob(events[0].aggregateId);
    if (!job) {
      throw new Error(`Import job ${events[0].aggregateId} was not projected.`);
    }
    return { job, events };
  }

  async createBankCsvImport(command: CreateBankCsvImportCommand): Promise<{ job: ImportJobRow; events: DomainEvent[] }> {
    const rows = parseCsv(command.csv);
    if (rows.length < 2) {
      throw new Error('Bank import CSV requires a header and at least one data row.');
    }
    const headers = rows[0].map(normalizeHeader);
    const importJobId = randomUUID();
    const items = rows.slice(1).map((cells, index) => this.bankRowToItem(importJobId, command, headers, cells, index));

    const events = await this.ledger.appendAndProject({
      aggregateType: 'import_job',
      aggregateId: importJobId,
      expectedVersion: 0,
      idempotencyKey: command.idempotencyKey,
      idempotencyPayload: command,
      events: [
        {
          type: 'ImportJobCreated',
          aggregateType: 'import_job',
          aggregateId: importJobId,
          groupId: command.groupId,
          actorId: command.actorId,
          payload: {
            importJobId,
            groupId: command.groupId,
            source: 'bank_csv',
            items
          },
          metadata: { command: 'create_bank_csv_import' }
        }
      ]
    });

    const job = this.importsExports.getImportJob(events[0].aggregateId);
    if (!job) {
      throw new Error(`Import job ${events[0].aggregateId} was not projected.`);
    }
    return { job, events };
  }

  async commitImport(command: CommitImportCommand): Promise<{ job: ImportJobRow; events: DomainEvent[] }> {
    const job = this.importsExports.getImportJob(command.importJobId);
    if (!job) {
      throw new Error(`Import job ${command.importJobId} was not found.`);
    }

    const itemEvents: DomainEvent[] = [];
    const commitEvents = [];
    for (const item of job.items.filter((candidate) => candidate.status === 'parsed')) {
        try {
          if (!item.expenseCommand) {
            throw new Error(item.error ?? 'Import item was not parsed into an expense command.');
          }
          const result = await this.expenses.createExpense({
            ...item.expenseCommand,
            actorId: command.actorId,
            idempotencyKey: `${command.idempotencyKey}:${item.itemId}`
          });
          itemEvents.push(...result.events);
          commitEvents.push({
            type: 'ImportItemCommitted' as const,
            aggregateType: 'import_job',
            aggregateId: command.importJobId,
            groupId: job.groupId,
            actorId: command.actorId,
            payload: {
              importJobId: command.importJobId,
              itemId: item.itemId,
              expenseId: result.expense.expenseId
            },
            metadata: { command: 'commit_import_item' }
          });
        } catch (error) {
          commitEvents.push({
            type: 'ImportItemCommitted' as const,
            aggregateType: 'import_job',
            aggregateId: command.importJobId,
            groupId: job.groupId,
            actorId: command.actorId,
            payload: {
              importJobId: command.importJobId,
              itemId: item.itemId,
              error: error instanceof Error ? error.message : String(error)
            },
            metadata: { command: 'commit_import_item_failed' }
          });
        }
    }

    const events = await this.ledger.appendAndProject({
      aggregateType: 'import_job',
      aggregateId: command.importJobId,
      expectedVersion: await this.ledger.getVersion('import_job', command.importJobId),
      idempotencyKey: command.idempotencyKey,
      idempotencyPayload: command,
      events: commitEvents
    });

    const updated = this.importsExports.getImportJob(command.importJobId);
    if (!updated) {
      throw new Error(`Import job ${command.importJobId} was not projected after commit.`);
    }
    return { job: updated, events: [...itemEvents, ...events] };
  }

  private rowToItem(
    importJobId: string,
    command: CreateSplitwiseCsvImportCommand,
    headers: string[],
    cells: string[],
    index: number
  ): ImportItemRow {
    const raw = Object.fromEntries(headers.map((header, headerIndex) => [header, cells[headerIndex]?.trim() ?? '']));
    const itemId = randomUUID();
    try {
      const description = readCell(raw, ['description', 'details', 'expense']);
      const expenseDate = readCell(raw, ['date', 'expense_date']);
      const category = readCell(raw, ['category'], 'Imported');
      const currencyCode = readCell(raw, ['currency', 'currency_code'], command.defaultCurrencyCode ?? 'INR');
      const amountCell = readCell(raw, ['amount_minor', 'amount', 'cost']);
      const amountMinor = raw.amount_minor ? Number.parseInt(raw.amount_minor, 10) : decimalToMinor(amountCell);
      const payerName = readCell(raw, ['payer', 'paid_by', 'created_by']);
      const participantNames = readCell(raw, ['participants', 'with', 'split_between'], payerName)
        .split(/[;|]/)
        .map((name) => name.trim())
        .filter(Boolean);
      const payerId = command.participantNameToId[payerName];
      const participantIds = participantNames.map((name) => command.participantNameToId[name]);
      if (!description || !expenseDate || !payerId || participantIds.some((participantId) => !participantId)) {
        throw new Error(`Import row ${index + 2} is missing description, date, payer mapping, or participant mapping.`);
      }
      return {
        itemId,
        importJobId,
        status: 'parsed',
        raw,
        expenseCommand: {
          groupId: command.groupId,
          description,
          category,
          expenseDate,
          currencyCode,
          payers: [{ participantId: payerId, amountMinor }],
          shares: participantIds.map((participantId) => ({
            participantId,
            shareType: 'equal' as const
          }))
        }
      };
    } catch (error) {
      return {
        itemId,
        importJobId,
        status: 'failed',
        raw,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private bankRowToItem(
    importJobId: string,
    command: CreateBankCsvImportCommand,
    headers: string[],
    cells: string[],
    index: number
  ): ImportItemRow {
    const raw = Object.fromEntries(headers.map((header, headerIndex) => [header, cells[headerIndex]?.trim() ?? '']));
    const itemId = randomUUID();
    try {
      const description = readCell(raw, ['description', 'narration', 'merchant', 'counterparty']);
      const expenseDate = readCell(raw, ['date', 'transaction_date', 'value_date']);
      const currencyCode = readCell(raw, ['currency', 'currency_code'], command.defaultCurrencyCode ?? 'INR');
      const debitCell = readCell(raw, ['debit', 'withdrawal', 'paid', 'amount_debit']);
      const amountCell = readCell(raw, ['amount', 'transaction_amount', 'value'], debitCell);
      const creditCell = readCell(raw, ['credit', 'deposit', 'received', 'amount_credit']);
      const inferredDebit = debitCell || (!creditCell && !/^cr|credit$/i.test(readCell(raw, ['type', 'direction'])));
      const amountMinor = Math.abs(raw.amount_minor ? Number.parseInt(raw.amount_minor, 10) : decimalToMinor(amountCell));
      if (!description || !expenseDate || !amountMinor || !inferredDebit) {
        throw new Error(`Bank row ${index + 2} is not a debit expense row or is missing date/description/amount.`);
      }
      const counterparty = command.counterpartyParticipantId ?? command.accountParticipantId;
      return {
        itemId,
        importJobId,
        status: 'parsed',
        raw,
        expenseCommand: {
          groupId: command.groupId,
          description,
          category: readCell(raw, ['category'], 'Bank import'),
          expenseDate,
          currencyCode,
          payers: [{ participantId: command.accountParticipantId, amountMinor }],
          shares:
            counterparty === command.accountParticipantId
              ? [{ participantId: command.accountParticipantId, shareType: 'exact' as const, amountMinor }]
              : [
                  { participantId: command.accountParticipantId, shareType: 'equal' as const },
                  { participantId: counterparty, shareType: 'equal' as const }
                ]
        }
      };
    } catch (error) {
      return {
        itemId,
        importJobId,
        status: 'failed',
        raw,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
