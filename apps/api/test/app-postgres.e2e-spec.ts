import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

const describePostgres = process.env.RUN_POSTGRES_E2E === 'true' ? describe : describe.skip;

async function createPostgresApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule]
  }).compile();

  const nextApp = moduleRef.createNestApplication();
  nextApp.setGlobalPrefix('v1');
  nextApp.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await nextApp.init();
  return nextApp;
}

describePostgres('AppModule with Postgres persistence', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-123456';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-123456';
    process.env.OTP_DEV_CODE = '123456';
    process.env.APP_PUBLIC_URL = 'http://localhost:3000';
    process.env.MOBILE_API_URL = 'http://localhost:3000';

    app = await createPostgresApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('runs OTP, group, expense, UPI proof, confirmation, balances, and audit activity on Postgres', async () => {
    const phone = `+9198${Date.now().toString().slice(-8)}`;
    const start = await request(app.getHttpServer())
      .post('/v1/auth/otp/start')
      .send({ phoneE164: phone })
      .expect(201);

    const verified = await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({ challengeId: start.body.challengeId, code: '123456', displayName: 'Postgres User' })
      .expect(200);
    const token = verified.body.tokens.accessToken;

    const group = await request(app.getHttpServer())
      .post('/v1/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Postgres Flat',
        mode: 'flat',
        participants: [{ displayName: 'Rahul', role: 'member' }]
      })
      .expect(201);

    const payer = group.body.participants.find((participant: any) => participant.displayName === 'Postgres User');
    const debtor = group.body.participants.find((participant: any) => participant.displayName === 'Rahul');
    expect(payer?.id).toBeDefined();
    expect(debtor?.id).toBeDefined();

    const expenseId = randomUUID();
    await request(app.getHttpServer())
      .post('/v1/expenses')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `pg-expense-${expenseId}`)
      .send({
        groupId: group.body.id,
        expenseId,
        description: 'Postgres dinner',
        expenseDate: '2026-07-10',
        currencyCode: 'INR',
        payers: [{ participantId: payer.id, amountMinor: 10000 }],
        shares: [
          { participantId: payer.id, shareType: 'equal' },
          { participantId: debtor.id, shareType: 'equal' }
        ]
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/v1/groups/${group.body.id}/balances`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => {
        expect([...body.balances].sort((a, b) => a.participantId.localeCompare(b.participantId))).toEqual([
          { groupId: group.body.id, participantId: payer.id, currencyCode: 'INR', amountMinor: 5000 },
          { groupId: group.body.id, participantId: debtor.id, currencyCode: 'INR', amountMinor: -5000 }
        ].sort((a, b) => a.participantId.localeCompare(b.participantId)));
      });

    await app.close();
    app = await createPostgresApp();

    await request(app.getHttpServer())
      .get(`/v1/groups/${group.body.id}/balances`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => {
        expect([...body.balances].sort((a, b) => a.participantId.localeCompare(b.participantId))).toEqual([
          { groupId: group.body.id, participantId: payer.id, currencyCode: 'INR', amountMinor: 5000 },
          { groupId: group.body.id, participantId: debtor.id, currencyCode: 'INR', amountMinor: -5000 }
        ].sort((a, b) => a.participantId.localeCompare(b.participantId)));
      });

    const settlementIntentId = randomUUID();
    await request(app.getHttpServer())
      .post('/v1/settlement-intents')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `pg-settlement-${settlementIntentId}`)
      .send({
        groupId: group.body.id,
        settlementIntentId,
        payerParticipantId: debtor.id,
        payeeParticipantId: payer.id,
        amountMinor: 5000,
        currencyCode: 'INR',
        payeeVpa: 'postgres@upi',
        payeeName: 'Postgres User'
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/settlement-intents/${settlementIntentId}/proofs`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `pg-proof-${settlementIntentId}`)
      .send({ amountMinor: 5000, utr: `PG${Date.now()}` })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/settlement-intents/${settlementIntentId}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `pg-confirm-${settlementIntentId}`)
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .get(`/v1/groups/${group.body.id}/balances`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.balances).toEqual([]);
      });

    await request(app.getHttpServer())
      .get(`/v1/groups/${group.body.id}/activity`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items.length).toBeGreaterThanOrEqual(2);
        expect(body.items.every((row: { type: string }) =>
          ['ExpenseCreated', 'ExpenseAdjusted', 'ExpenseVoided', 'SettlementLedgerPosted', 'SettlementReversed', 'SettlementRefunded'].includes(row.type)
        )).toBe(true);
        expect(body.nextCursor === null || typeof body.nextCursor === 'number').toBe(true);
      });

    await request(app.getHttpServer())
      .get(`/v1/groups/${group.body.id}/activity?feed=all`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items.length).toBeGreaterThanOrEqual(4);
      });
  });

  it('rejects direct unbalanced ledger postings through the database constraint trigger', async () => {
    const dataSource = app.get(DataSource);
    const userId = randomUUID();
    const groupId = randomUUID();
    const participantId = randomUUID();
    const eventId = randomUUID();
    const aggregateId = randomUUID();
    const sourceId = randomUUID();

    await dataSource.query(
      `INSERT INTO users (id, phone_e164, display_name, default_currency_code, locale, status, state)
       VALUES ($1, $2, $3, 'INR', 'en-IN', 'active', 'active')`,
      [userId, `+9197${Date.now().toString().slice(-8)}`, 'DB Constraint User']
    );
    await dataSource.query(
      `INSERT INTO groups (id, name, mode, base_currency_code, state, created_by_user_id)
       VALUES ($1, $2, 'flat', 'INR', 'active', $3)`,
      [groupId, 'DB Constraint Group', userId]
    );
    await dataSource.query(
      `INSERT INTO participants (id, group_id, registered_user_id, participant_type, display_name, kind, linked_user_id, state)
       VALUES ($1, $2, $3, 'individual', 'DB Constraint User', 'user', $3, 'active')`,
      [participantId, groupId, userId]
    );
    await dataSource.query(
      `INSERT INTO event_store (
        id, stream_id, aggregate_type, aggregate_id, group_id, version, event_type,
        event_schema_version, actor_user_id, correlation_id, payload, metadata, event_hash
       )
       VALUES ($1, $2, 'expense', $3, $4, 1, 'expense.created', 1, $5, $6, '{}'::jsonb, '{}'::jsonb, $7)`,
      [eventId, `expense-${aggregateId}`, aggregateId, groupId, userId, randomUUID(), `hash-${eventId}`]
    );

    await expect(
      dataSource.transaction(async (manager) => {
        await manager.query(
          `INSERT INTO ledger_postings (
            event_id, group_id, participant_id, currency_code, signed_amount_minor,
            posting_type, source_type, source_id
          )
          VALUES ($1, $2, $3, 'INR', 100, 'expense_payment', 'expense', $4)`,
          [eventId, groupId, participantId, sourceId]
        );
      })
    ).rejects.toThrow(/Ledger postings are not balanced/);
  });
});
