import { createFinancialTestApp } from '../support/financial-test-app';

describe('imports, exports, and offline sync', () => {
  it('imports Splitwise-style CSV, commits expenses, and exports CSV', async () => {
    const app = createFinancialTestApp();
    const csv = [
      'date,description,category,currency,amount,payer,participants',
      '2026-07-10,Tea,Food,INR,100.00,Alice,Alice;Bob'
    ].join('\n');

    const imported = await app.services.imports.createImport({
      idempotencyKey: 'import-create-1',
      actorId: 'user-a',
      groupId: 'group-1',
      csv,
      participantNameToId: {
        Alice: 'p-a',
        Bob: 'p-b'
      }
    });
    expect(imported.job.items).toHaveLength(1);
    expect(imported.job.items[0].status).toBe('parsed');

    const committed = await app.services.imports.commitImport({
      idempotencyKey: 'import-commit-1',
      actorId: 'user-a',
      importJobId: imported.job.importJobId
    });
    expect(committed.job.status).toBe('committed');
    expect(app.projectors.expenses.listGroupExpenses('group-1')).toHaveLength(1);

    const exported = await app.services.exports.createExport({
      idempotencyKey: 'export-1',
      actorId: 'user-a',
      groupId: 'group-1',
      exportType: 'full_group_csv'
    });
    expect(exported.job.data).toContain('Tea');
    expect(exported.job.data).toContain('participant_id');
  });

  it('imports bank debit CSV and renders PDF, Tally, and data-portability exports', async () => {
    const app = createFinancialTestApp();
    const bankCsv = [
      'date,narration,debit,currency',
      '2026-07-11,UPI grocery payment,240.50,INR'
    ].join('\n');

    const imported = await app.services.imports.createBankCsvImport({
      idempotencyKey: 'bank-import-create-1',
      actorId: 'user-a',
      groupId: 'group-bank',
      csv: bankCsv,
      accountParticipantId: 'p-a',
      counterpartyParticipantId: 'p-b'
    });
    expect(imported.job.items[0]).toMatchObject({
      status: 'parsed',
      expenseCommand: expect.objectContaining({ description: 'UPI grocery payment' })
    });

    await app.services.imports.commitImport({
      idempotencyKey: 'bank-import-commit-1',
      actorId: 'user-a',
      importJobId: imported.job.importJobId
    });

    const tally = await app.services.exports.createExport({
      idempotencyKey: 'bank-export-tally',
      actorId: 'user-a',
      groupId: 'group-bank',
      exportType: 'tally_csv'
    });
    expect(tally.job.contentType).toBe('text/csv');
    expect(tally.job.data).toContain('voucher_type');

    const pdf = await app.services.exports.createExport({
      idempotencyKey: 'bank-export-pdf',
      actorId: 'user-a',
      groupId: 'group-bank',
      exportType: 'group_pdf'
    });
    expect(pdf.job.contentType).toBe('application/pdf');
    expect(Buffer.from(pdf.job.data, 'base64').toString('utf8')).toContain('%PDF-1.4');

    const portable = await app.services.exports.createExport({
      idempotencyKey: 'bank-export-json',
      actorId: 'user-a',
      groupId: 'group-bank',
      exportType: 'data_portability_json'
    });
    expect(portable.job.contentType).toBe('application/json');
    expect(JSON.parse(portable.job.data).expenses[0].description).toBe('UPI grocery payment');
  });

  it('executes offline command batches with idempotent duplicate commands and cursor replay', async () => {
    const app = createFinancialTestApp();
    const payload = {
      idempotencyKey: 'offline-expense-1',
      actorId: 'user-a',
      groupId: 'group-1',
      expenseId: 'expense-offline-1',
      description: 'Taxi',
      expenseDate: '2026-07-10',
      currencyCode: 'INR',
      payers: [{ participantId: 'p-a', amountMinor: 9000 }],
      shares: [
        { participantId: 'p-a', shareType: 'equal' as const },
        { participantId: 'p-b', shareType: 'equal' as const },
        { participantId: 'p-c', shareType: 'equal' as const }
      ]
    };

    const response = await app.services.offlineSync.executeBatch({
      cursor: 0,
      commands: [
        {
          clientMutationId: 'client-1',
          idempotencyKey: 'offline-expense-1',
          commandType: 'expense.create',
          payload
        },
        {
          clientMutationId: 'client-1-retry',
          idempotencyKey: 'offline-expense-1',
          commandType: 'expense.create',
          payload
        }
      ]
    });

    expect(response.results.map((result) => result.status)).toEqual(['accepted', 'accepted']);
    expect(response.results[1].eventIds).toEqual(response.results[0].eventIds);
    expect((await app.ledger.replay()).filter((event) => event.type === 'ExpenseCreated')).toHaveLength(1);
    expect(response.nextCursor).toBe(1);
    expect((await app.services.offlineSync.sync(response.nextCursor)).events).toEqual([]);
  });
});
