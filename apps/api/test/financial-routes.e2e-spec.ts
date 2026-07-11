import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { BANK_IMPORT_PROVIDER } from '../src/modules/imports-exports';
import { FinancialLedgerModule } from '../src/modules/ledger/financial-ledger.module';

describe('financial HTTP routes', () => {
  let app: INestApplication;
  let storageRoot: string | undefined;
  const userId = '22222222-2222-4222-8222-222222222222';

  class TestAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const requestContext = context.switchToHttp().getRequest();
      requestContext.user = { userId, phoneE164: '+919876543210' };
      return true;
    }
  }

  const bankImportProvider = {
    createConsent: jest.fn(async () => ({
      provider: 'setu_aa',
      consentId: 'route-consent-1',
      status: 'pending',
      redirectUrl: 'https://aa.example/route-consent-1',
      rawPayload: { consentId: 'route-consent-1' }
    })),
    fetchTransactions: jest.fn(async () => [
      {
        transactionId: 'route-aa-txn-1',
        date: '2026-07-10',
        narration: 'AA grocery payment',
        amountMinor: 12345,
        currencyCode: 'INR',
        direction: 'debit',
        rawPayload: { transactionId: 'route-aa-txn-1' }
      }
    ])
  };

  beforeAll(async () => {
    storageRoot = await mkdtemp(path.join(tmpdir(), 'splitsaathi-route-storage-'));
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/splitsaathi_test';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-123456';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-123456';
    process.env.OTP_DEV_CODE = '123456';
    process.env.APP_PUBLIC_URL = 'http://localhost:3000';
    process.env.MOBILE_API_URL = 'http://localhost:3000';
    process.env.LOCAL_OBJECT_STORAGE_DIR = storageRoot;

    const moduleRef = await Test.createTestingModule({
      imports: [FinancialLedgerModule]
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(TestAuthGuard)
      .overrideProvider(BANK_IMPORT_PROVIDER)
      .useValue(bankImportProvider)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    if (storageRoot?.startsWith(tmpdir())) {
      await rm(storageRoot, { recursive: true, force: true });
    }
  });

  it('posts an expense, settles it through UPI proof, and exposes activity/sync routes', async () => {
    await request(app.getHttpServer())
      .post('/v1/expenses')
      .set('Idempotency-Key', 'route-expense-create-1')
      .send({
        groupId: 'route-group-1',
        expenseId: 'route-expense-1',
        description: 'Route dinner',
        expenseDate: '2026-07-10',
        currencyCode: 'INR',
        payers: [{ participantId: 'route-pa', amountMinor: 10000 }],
        shares: [
          { participantId: 'route-pa', shareType: 'equal' },
          { participantId: 'route-pb', shareType: 'equal' }
        ]
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.expense.version).toBe(1);
      });

    await request(app.getHttpServer())
      .get('/v1/groups/route-group-1/balances')
      .expect(200)
      .expect(({ body }) => {
        expect(body.balances).toEqual([
          { groupId: 'route-group-1', participantId: 'route-pa', currencyCode: 'INR', amountMinor: 5000 },
          { groupId: 'route-group-1', participantId: 'route-pb', currencyCode: 'INR', amountMinor: -5000 }
        ]);
      });

    const suggestion = await request(app.getHttpServer())
      .get('/v1/groups/route-group-1/settlement-suggestions')
      .expect(200);
    expect(suggestion.body[0]).toMatchObject({
      payerParticipantId: 'route-pb',
      payeeParticipantId: 'route-pa',
      amountMinor: 5000
    });

    const created = await request(app.getHttpServer())
      .post('/v1/settlement-intents')
      .set('Idempotency-Key', 'route-settlement-create-1')
      .send({
        groupId: 'route-group-1',
        settlementIntentId: '33333333-3333-4333-8333-333333333333',
        payerParticipantId: 'route-pb',
        payeeParticipantId: 'route-pa',
        amountMinor: 5000,
        currencyCode: 'INR',
        payeeVpa: 'alice@upi',
        payeeName: 'Alice'
      })
      .expect(201);
    expect(created.body.intent.upiUri).toContain('upi://pay');

    await request(app.getHttpServer())
      .post('/v1/settlement-intents/33333333-3333-4333-8333-333333333333/upi/opened')
      .set('Idempotency-Key', 'route-settlement-open-1')
      .send({ upiApp: 'gpay' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.intent.state).toBe('payer_opened_upi_app');
      });

    await request(app.getHttpServer())
      .post('/v1/settlement-intents/33333333-3333-4333-8333-333333333333/proofs')
      .set('Idempotency-Key', 'route-settlement-proof-1')
      .send({ amountMinor: 5000, utr: 'ROUTE-UTR-1' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.intent.state).toBe('awaiting_receiver_confirmation');
      });

    await request(app.getHttpServer())
      .post('/v1/settlement-intents/33333333-3333-4333-8333-333333333333/confirm')
      .set('Idempotency-Key', 'route-settlement-confirm-1')
      .send({})
      .expect(201)
      .expect(({ body }) => {
        expect(body.intent.state).toBe('ledger_posted');
      });

    await request(app.getHttpServer())
      .get('/v1/groups/route-group-1/balances')
      .expect(200)
      .expect(({ body }) => {
        expect(body.balances).toEqual([]);
      });

    await request(app.getHttpServer())
      .post('/v1/settlement-intents/33333333-3333-4333-8333-333333333333/reverse')
      .set('Idempotency-Key', 'route-settlement-reverse-1')
      .send({ reason: 'Receiver reported a refund after confirmation.' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.intent.state).toBe('reversed');
      });

    await request(app.getHttpServer())
      .get('/v1/settlement-intents/33333333-3333-4333-8333-333333333333')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          settlementIntentId: '33333333-3333-4333-8333-333333333333',
          state: 'reversed'
        });
      });

    await request(app.getHttpServer())
      .get('/v1/groups/route-group-1/settlement-intents')
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((intent: any) => intent.settlementIntentId)).toContain(
          '33333333-3333-4333-8333-333333333333'
        );
      });

    await request(app.getHttpServer())
      .get('/v1/groups/route-group-1/balances')
      .expect(200)
      .expect(({ body }) => {
        expect(body.balances).toEqual([
          { groupId: 'route-group-1', participantId: 'route-pa', currencyCode: 'INR', amountMinor: 5000 },
          { groupId: 'route-group-1', participantId: 'route-pb', currencyCode: 'INR', amountMinor: -5000 }
        ]);
      });

    await request(app.getHttpServer())
      .get('/v1/groups/route-group-1/activity')
      .expect(200)
      .expect(({ body }) => {
        expect(body.length).toBeGreaterThanOrEqual(1);
      });

    await request(app.getHttpServer())
      .get('/v1/sync?cursor=0')
      .expect(200)
      .expect(({ body }) => {
        expect(body.events.length).toBeGreaterThanOrEqual(1);
        expect(body.nextCursor).toBeGreaterThanOrEqual(1);
      });
  });

  it('accepts receipt drafts, recurring schedules, imports, exports, and offline batches over HTTP', async () => {
    const attachment = await request(app.getHttpServer())
      .post('/v1/attachments')
      .field('purpose', 'receipt')
      .attach('file', Buffer.from('receipt bytes'), {
        filename: 'receipt.txt',
        contentType: 'text/plain'
      })
      .expect(201);
    expect(attachment.body.id).toBeDefined();
    expect(attachment.body.storageProvider).toBe('local-filesystem');
    expect(attachment.body.storageKey).toContain('attachments/');
    expect(attachment.body.sizeBytes).toBe(Buffer.byteLength('receipt bytes'));
    expect(attachment.body.sha256).toBe('9e85aa95f04db5f108534e48b63e75e8045a7ecab59988405e70a9260300a0d6');

    const draft = await request(app.getHttpServer())
      .post('/v1/receipt-drafts')
      .send({ groupId: 'route-group-2', attachmentId: attachment.body.id, source: 'gallery' })
      .expect(201);
    expect(draft.body.id).toBeDefined();

    await request(app.getHttpServer())
      .post(`/v1/receipt-drafts/${draft.body.id}/ocr`)
      .send({})
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          receiptDraftId: draft.body.id,
          provider: 'noop',
          needsHumanReview: true
        });
      });

    await request(app.getHttpServer())
      .post('/v1/capture-jobs')
      .send({ source: 'sms_manual', rawText: 'Paid INR 120.50 via UPI Ref ABCD123456 on 2026-07-10' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.parsedResult).toMatchObject({
          amountMinor: 12050,
          currencyCode: 'INR',
          reference: 'ABCD123456',
          needsReview: true
        });
      });

    await request(app.getHttpServer())
      .post(`/v1/receipt-drafts/${draft.body.id}/post-expense`)
      .set('Idempotency-Key', 'route-receipt-expense-1')
      .send({
        groupId: 'route-group-2',
        expenseId: 'route-receipt-expense-1',
        description: 'Receipt snacks',
        expenseDate: '2026-07-10',
        currencyCode: 'INR',
        payers: [{ participantId: 'route-rp1', amountMinor: 9000 }],
        shares: [
          { participantId: 'route-rp1', shareType: 'equal' },
          { participantId: 'route-rp2', shareType: 'equal' },
          { participantId: 'route-rp3', shareType: 'equal' }
        ]
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.expense.expenseId).toBe('route-receipt-expense-1');
      });

    await request(app.getHttpServer())
      .post('/v1/recurring-schedules')
      .set('Idempotency-Key', 'route-recurring-1')
      .send({
        groupId: 'route-group-2',
        recurringScheduleId: '44444444-4444-4444-8444-444444444444',
        cadence: 'monthly',
        startDate: '2026-07-10',
        template: {
          description: 'Rent',
          currencyCode: 'INR',
          payers: [{ participantId: 'route-rp1', amountMinor: 3000000 }],
          shares: [
            { participantId: 'route-rp1', shareType: 'equal' },
            { participantId: 'route-rp2', shareType: 'equal' }
          ]
        }
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.schedule.recurringScheduleId).toBe('44444444-4444-4444-8444-444444444444');
      });

    await request(app.getHttpServer())
      .post('/v1/reminder-schedules')
      .send({ groupId: 'route-group-2', type: 'recurring_expense', schedule: { day: 1, hour: 9 } })
      .expect(201)
      .expect(({ body }) => {
        expect(body.status).toBe('active');
      });

    await request(app.getHttpServer())
      .post('/v1/reminder-schedules/due')
      .send({ asOf: '2026-08-01T09:00:00' })
      .expect(201)
      .expect(({ body }) => {
        expect(body[0]).toMatchObject({
          groupId: 'route-group-2',
          type: 'recurring_expense',
          title: 'Recurring bill ready'
        });
      });

    await request(app.getHttpServer())
      .get('/v1/groups/route-group-2/reminder-schedules')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            groupId: 'route-group-2',
            type: 'recurring_expense',
            status: 'active'
          })
        ]);
      });

    const csv = [
      'date,description,category,currency,amount,payer,participants',
      '2026-07-10,Tea,Food,INR,100.00,Alice,Alice;Bob'
    ].join('\n');
    const imported = await request(app.getHttpServer())
      .post('/v1/imports/splitwise')
      .set('Idempotency-Key', 'route-import-1')
      .send({
        groupId: 'route-group-2',
        csv,
        participantNameToId: { Alice: 'route-rp1', Bob: 'route-rp2' }
      })
      .expect(201);
    expect(imported.body.job.items[0].status).toBe('parsed');

    const bankImported = await request(app.getHttpServer())
      .post('/v1/imports/bank/csv')
      .set('Idempotency-Key', 'route-bank-import-1')
      .send({
        groupId: 'route-group-2',
        csv: ['date,narration,debit,currency', '2026-07-10,Snacks from bank statement,45.00,INR'].join('\n'),
        accountParticipantId: 'route-rp1',
        counterpartyParticipantId: 'route-rp2'
      })
      .expect(201);
    expect(bankImported.body.job.items[0].status).toBe('parsed');

    await request(app.getHttpServer())
      .post('/v1/imports/bank/aa/consents')
      .send({
        customerReference: 'route-user',
        phoneNumber: '+919876543210',
        fromDate: '2026-07-01',
        toDate: '2026-07-10'
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          provider: 'setu_aa',
          consentId: 'route-consent-1',
          status: 'pending'
        });
      });

    const aaImported = await request(app.getHttpServer())
      .post('/v1/imports/bank/aa/transactions')
      .set('Idempotency-Key', 'route-bank-aa-import-1')
      .send({
        groupId: 'route-group-2',
        consentId: 'route-consent-1',
        fromDate: '2026-07-01',
        toDate: '2026-07-10',
        accountParticipantId: 'route-rp1',
        counterpartyParticipantId: 'route-rp2'
      })
      .expect(201);
    expect(aaImported.body.job.items[0]).toMatchObject({
      status: 'parsed',
      expenseCommand: expect.objectContaining({ description: 'AA grocery payment' })
    });

    await request(app.getHttpServer())
      .post(`/v1/imports/${imported.body.job.importJobId}/commit`)
      .set('Idempotency-Key', 'route-import-commit-1')
      .send({})
      .expect(201)
      .expect(({ body }) => {
        expect(body.job.status).toBe('committed');
      });

    const exported = await request(app.getHttpServer())
      .post('/v1/exports')
      .set('Idempotency-Key', 'route-export-1')
      .send({ groupId: 'route-group-2', exportType: 'full_group_csv' })
      .expect(201);
    expect(exported.body.job.data).toContain('Tea');

    await request(app.getHttpServer())
      .post('/v1/exports')
      .set('Idempotency-Key', 'route-export-pdf-1')
      .send({ groupId: 'route-group-2', exportType: 'group_pdf' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.job.contentType).toBe('application/pdf');
        expect(Buffer.from(body.job.data, 'base64').toString('utf8')).toContain('%PDF');
      });

    await request(app.getHttpServer())
      .post('/v1/exports')
      .set('Idempotency-Key', 'route-export-invalid')
      .send({ groupId: 'route-group-2', exportType: 'unknown_export' })
      .expect(400);

    await request(app.getHttpServer())
      .get('/v1/currency/convert?amountMinor=100&base=INR&quote=INR')
      .expect(200)
      .expect(({ body }) => {
        expect(body.amountMinor).toBe(100);
        expect(body.rate.provider).toBe('identity');
      });

    await request(app.getHttpServer())
      .post('/v1/commands/batch')
      .send({
        cursor: 0,
        commands: [
          {
            clientMutationId: 'route-client-1',
            idempotencyKey: 'route-offline-expense-1',
            commandType: 'expense.create',
            payload: {
              idempotencyKey: 'route-offline-expense-1',
              actorId: userId,
              groupId: 'route-group-3',
              expenseId: 'route-offline-expense-1',
              description: 'Offline auto',
              expenseDate: '2026-07-10',
              currencyCode: 'INR',
              payers: [{ participantId: 'route-op1', amountMinor: 2000 }],
              shares: [
                { participantId: 'route-op1', shareType: 'equal' },
                { participantId: 'route-op2', shareType: 'equal' }
              ]
            }
          }
        ]
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.results[0].status).toBe('accepted');
      });
  });

  it('revises, lists, shows history for, and voids expenses over HTTP', async () => {
    await request(app.getHttpServer())
      .post('/v1/expenses')
      .set('Idempotency-Key', 'route-expense-lifecycle-create')
      .send({
        groupId: 'route-group-4',
        expenseId: 'route-expense-lifecycle',
        description: 'Lifecycle lunch',
        expenseDate: '2026-07-10',
        currencyCode: 'INR',
        payers: [{ participantId: 'route-lp1', amountMinor: 12000 }],
        shares: [
          { participantId: 'route-lp1', shareType: 'equal' },
          { participantId: 'route-lp2', shareType: 'equal' }
        ]
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/expenses/route-expense-lifecycle/revisions')
      .set('Idempotency-Key', 'route-expense-lifecycle-revise')
      .send({
        groupId: 'route-group-4',
        expectedVersion: 1,
        description: 'Lifecycle lunch and chai',
        expenseDate: '2026-07-10',
        currencyCode: 'INR',
        payers: [{ participantId: 'route-lp1', amountMinor: 14000 }],
        shares: [
          { participantId: 'route-lp1', shareType: 'exact', amountMinor: 6000 },
          { participantId: 'route-lp2', shareType: 'exact', amountMinor: 8000 }
        ],
        reason: 'Added chai'
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.expense).toMatchObject({
          expenseId: 'route-expense-lifecycle',
          description: 'Lifecycle lunch and chai',
          version: 2
        });
      });

    await request(app.getHttpServer())
      .get('/v1/groups/route-group-4/expenses')
      .expect(200)
      .expect(({ body }) => {
        expect(body.some((expense: any) => expense.expenseId === 'route-expense-lifecycle')).toBe(true);
      });

    await request(app.getHttpServer())
      .get('/v1/expenses/route-expense-lifecycle/history')
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((event: any) => event.eventType)).toEqual(['ExpenseCreated', 'ExpenseAdjusted']);
      });

    await request(app.getHttpServer())
      .post('/v1/expenses/route-expense-lifecycle/void')
      .set('Idempotency-Key', 'route-expense-lifecycle-void')
      .send({ groupId: 'route-group-4', expectedVersion: 2, reason: 'Duplicate entry' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.events[0].type).toBe('ExpenseVoided');
      });

    await request(app.getHttpServer())
      .get('/v1/expenses/route-expense-lifecycle/history')
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((event: any) => event.eventType)).toEqual(['ExpenseCreated', 'ExpenseAdjusted', 'ExpenseVoided']);
      });
  });

  it('returns explicit validation errors for missing idempotency and invalid UPI inputs', async () => {
    await request(app.getHttpServer())
      .post('/v1/expenses')
      .send({
        groupId: 'route-group-validation',
        description: 'No idempotency key',
        expenseDate: '2026-07-10',
        currencyCode: 'INR',
        payers: [{ participantId: 'route-vp1', amountMinor: 1000 }],
        shares: [{ participantId: 'route-vp1', shareType: 'equal' }]
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toContain('Idempotency-Key');
      });

    await request(app.getHttpServer())
      .post('/v1/settlement-intents')
      .set('Idempotency-Key', 'route-invalid-upi-vpa')
      .send({
        groupId: 'route-group-validation',
        settlementIntentId: '55555555-5555-4555-8555-555555555555',
        payerParticipantId: 'route-vp1',
        payeeParticipantId: 'route-vp2',
        amountMinor: 1000,
        currencyCode: 'INR',
        payeeVpa: 'not-a-vpa',
        payeeName: 'Invalid VPA'
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toContain('VPA');
      });
  });
});
