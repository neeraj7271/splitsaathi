import { randomUUID } from 'node:crypto';
import { BalanceProjector, ExpenseProjector, LedgerService, type DomainEvent } from '../ledger';
import { toCsv } from './csv';
import { ImportsExportsProjector } from './imports-exports.projector';
import type { CreateExportCommand, ExportJobRow } from './imports-exports.types';

export class CsvExportService {
  constructor(
    private readonly ledger: LedgerService,
    private readonly importsExports: ImportsExportsProjector,
    private readonly expenses: ExpenseProjector,
    private readonly balances: BalanceProjector
  ) {}

  async createExport(command: CreateExportCommand): Promise<{ job: ExportJobRow; events: DomainEvent[] }> {
    const exportJobId = command.exportJobId ?? randomUUID();
    const rendered = this.renderExport(command);
    const payload: ExportJobRow = {
      exportJobId,
      groupId: command.groupId,
      exportType: command.exportType,
      status: 'ready',
      contentType: rendered.contentType,
      data: rendered.data,
      createdBy: command.actorId,
      createdAt: new Date().toISOString()
    };
    const events = await this.ledger.appendAndProject({
      aggregateType: 'export_job',
      aggregateId: exportJobId,
      expectedVersion: 0,
      idempotencyKey: command.idempotencyKey,
      idempotencyPayload: command,
      events: [
        {
          type: 'ExportJobCreated',
          aggregateType: 'export_job',
          aggregateId: exportJobId,
          groupId: command.groupId,
          actorId: command.actorId,
          payload,
          metadata: { command: 'create_csv_export' }
        }
      ]
    });

    const job = this.importsExports.getExportJob(events[0].aggregateId);
    if (!job) {
      throw new Error(`Export job ${events[0].aggregateId} was not projected.`);
    }
    return { job, events };
  }

  private renderExport(command: CreateExportCommand): { contentType: ExportJobRow['contentType']; data: string } {
    if (command.exportType === 'group_pdf' || command.exportType === 'settlement_certificate') {
      return {
        contentType: 'application/pdf',
        data: this.buildPdf(command).toString('base64')
      };
    }
    if (command.exportType === 'data_portability_json') {
      return {
        contentType: 'application/json',
        data: JSON.stringify(
          {
            groupId: command.groupId,
            generatedAt: new Date().toISOString(),
            expenses: this.expenses.listGroupExpenses(command.groupId),
            balances: this.balances.listGroupBalances(command.groupId)
          },
          null,
          2
        )
      };
    }
    return {
      contentType: 'text/csv',
      data: this.buildCsv(command)
    };
  }

  private buildCsv(command: CreateExportCommand): string {
    if (command.exportType === 'tally_csv') {
      return toCsv([
        ['date', 'voucher_type', 'ledger', 'debit_minor', 'credit_minor', 'currency', 'narration'],
        ...this.expenses.listGroupExpenses(command.groupId).flatMap((expense) => [
          [
            expense.expenseDate,
            'Payment',
            `Paid by ${expense.payers.map((payer) => payer.participantId).join(';')}`,
            expense.totalAmountMinor,
            '',
            expense.currencyCode,
            expense.description
          ],
          [
            expense.expenseDate,
            'Journal',
            `Shared by ${expense.shares.map((share) => share.participantId).join(';')}`,
            '',
            expense.totalAmountMinor,
            expense.currencyCode,
            expense.description
          ]
        ])
      ]);
    }

    if (command.exportType === 'balances_csv') {
      return toCsv([
        ['participant_id', 'currency_code', 'amount_minor'],
        ...this.balances
          .listGroupBalances(command.groupId)
          .map((row) => [row.participantId, row.currencyCode, row.amountMinor])
      ]);
    }

    const expenseRows = [
      ['expense_id', 'date', 'description', 'category', 'currency_code', 'total_amount_minor', 'status'],
      ...this.expenses
        .listGroupExpenses(command.groupId)
        .map((expense) => [
          expense.expenseId,
          expense.expenseDate,
          expense.description,
          expense.category,
          expense.currencyCode,
          expense.totalAmountMinor,
          expense.status
        ])
    ];

    if (command.exportType === 'expenses_csv') {
      return toCsv(expenseRows);
    }

    const balanceRows = [
      [],
      ['participant_id', 'currency_code', 'amount_minor'],
      ...this.balances
        .listGroupBalances(command.groupId)
        .map((row) => [row.participantId, row.currencyCode, row.amountMinor])
    ];
    return toCsv([...expenseRows, ...balanceRows]);
  }

  private buildPdf(command: CreateExportCommand): Buffer {
    const title =
      command.exportType === 'settlement_certificate'
        ? `SplitSaathi Settlement Certificate ${command.groupId}`
        : `SplitSaathi Group Statement ${command.groupId}`;
    const bodyLines = [
      title,
      `Generated: ${new Date().toISOString()}`,
      '',
      'Expenses',
      ...this.expenses
        .listGroupExpenses(command.groupId)
        .map((expense) => `${expense.expenseDate} ${expense.currencyCode} ${expense.totalAmountMinor} ${expense.description}`),
      '',
      'Balances',
      ...this.balances
        .listGroupBalances(command.groupId)
        .map((balance) => `${balance.participantId} ${balance.currencyCode} ${balance.amountMinor}`)
    ];
    return minimalPdf(bodyLines);
  }
}

function minimalPdf(lines: string[]): Buffer {
  const escaped = lines.map((line) => line.replace(/[()\\]/g, '\\$&'));
  const textOps = escaped.map((line, index) => `1 0 0 1 48 ${760 - index * 16} Tm (${line.slice(0, 90)}) Tj`).join('\n');
  const stream = `BT\n/F1 10 Tf\n${textOps}\nET`;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj`
  ];
  let offset = '%PDF-1.4\n'.length;
  const xref = ['0000000000 65535 f '];
  const body = objects
    .map((object) => {
      xref.push(`${String(offset).padStart(10, '0')} 00000 n `);
      offset += Buffer.byteLength(`${object}\n`);
      return object;
    })
    .join('\n');
  const xrefStart = Buffer.byteLength(`%PDF-1.4\n${body}\n`);
  return Buffer.from(
    `%PDF-1.4\n${body}\nxref\n0 ${xref.length}\n${xref.join('\n')}\ntrailer << /Root 1 0 R /Size ${xref.length} >>\nstartxref\n${xrefStart}\n%%EOF`
  );
}
