import { MonthlySummaryMailService } from '../../src/modules/jobs/monthly-summary-mail.service';
import { BalanceProjector } from '../../src/modules/ledger/balance.projector';
import type { DomainEvent } from '../../src/modules/ledger/ledger.types';

describe('MonthlySummaryMailService', () => {
  it('emails members with emailMonthlySummary + verified credential and skips others', async () => {
    const groups = {
      find: jest.fn(async () => [{ id: 'g1', name: 'Flat', baseCurrencyCode: 'INR', state: 'active' }])
    };
    const memberships = {
      find: jest.fn(async () => [
        { groupId: 'g1', userId: 'u-opt-in', status: 'active' },
        { groupId: 'g1', userId: 'u-opt-out', status: 'active' },
        { groupId: 'g1', userId: 'u-no-email', status: 'active' },
        { groupId: 'g1', userId: null, status: 'active' }
      ])
    };
    const participants = {
      find: jest.fn(async () => [
        { id: 'p1', groupId: 'g1', displayName: 'Alice', linkedUserId: 'u-opt-in' },
        { id: 'p2', groupId: 'g1', displayName: 'Bob', linkedUserId: null }
      ])
    };
    const preferences = {
      findOne: jest.fn(async ({ where }: { where: { userId: string } }) => {
        if (where.userId === 'u-opt-out') {
          return { userId: where.userId, emailMonthlySummary: false };
        }
        if (where.userId === 'u-opt-in' || where.userId === 'u-no-email') {
          return { userId: where.userId, emailMonthlySummary: true };
        }
        return null;
      })
    };
    const emailCredentials = {
      findOne: jest.fn(async ({ where }: { where: { userId: string } }) => {
        if (where.userId === 'u-opt-in') {
          return { userId: 'u-opt-in', email: 'alice@example.com', verifiedAt: new Date() };
        }
        return null;
      })
    };
    const identities = {
      findOne: jest.fn(async () => null)
    };
    const emailProvider = {
      send: jest.fn(async () => ({ deliveryMode: 'development' as const })),
      sendOtp: jest.fn()
    };

    const balances = new BalanceProjector();
    balances.apply({
      eventId: 'e1',
      type: 'expense.created',
      groupId: 'g1',
      aggregateId: 'g1',
      aggregateType: 'group',
      aggregateVersion: 1,
      occurredAt: new Date().toISOString(),
      actorId: 'test',
      payload: {},
      postings: [
        { participantId: 'p1', currencyCode: 'INR', signedAmountMinor: 5000 },
        { participantId: 'p2', currencyCode: 'INR', signedAmountMinor: -5000 }
      ]
    } as unknown as DomainEvent);

    const service = new MonthlySummaryMailService(
      groups as any,
      memberships as any,
      participants as any,
      preferences as any,
      emailCredentials as any,
      identities as any,
      balances,
      emailProvider as any
    );

    const result = await service.sendMonthlySettlementSummaries();

    expect(result).toEqual({ groupsProcessed: 1, emailsSent: 1, emailsFailed: 0, skipped: 3 });
    expect(emailProvider.send).toHaveBeenCalledTimes(1);
    expect(emailProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'alice@example.com',
        subject: expect.stringContaining('Flat'),
        html: expect.stringContaining('Suggested settlements'),
        text: expect.stringContaining('Overview:')
      })
    );
  });

  it('continues sending when one recipient fails', async () => {
    const groups = {
      find: jest.fn(async () => [{ id: 'g1', name: 'Flat', baseCurrencyCode: 'INR', state: 'active' }])
    };
    const memberships = {
      find: jest.fn(async () => [
        { groupId: 'g1', userId: 'u-1', status: 'active' },
        { groupId: 'g1', userId: 'u-2', status: 'active' }
      ])
    };
    const participants = {
      find: jest.fn(async () => [
        { id: 'p1', groupId: 'g1', displayName: 'Alice', linkedUserId: 'u-1' },
        { id: 'p2', groupId: 'g1', displayName: 'Bob', linkedUserId: 'u-2' }
      ])
    };
    const preferences = { findOne: jest.fn(async () => null) };
    const emailCredentials = {
      findOne: jest.fn(async ({ where }: { where: { userId: string } }) => ({
        userId: where.userId,
        email: `${where.userId}@example.com`,
        verifiedAt: new Date()
      }))
    };
    const identities = { findOne: jest.fn(async () => null) };
    const emailProvider = {
      send: jest
        .fn()
        .mockRejectedValueOnce(new Error('Brevo down'))
        .mockResolvedValueOnce({ deliveryMode: 'brevo' as const }),
      sendOtp: jest.fn()
    };
    const balances = new BalanceProjector();

    const service = new MonthlySummaryMailService(
      groups as any,
      memberships as any,
      participants as any,
      preferences as any,
      emailCredentials as any,
      identities as any,
      balances,
      emailProvider as any
    );

    const result = await service.sendMonthlySettlementSummaries();

    expect(result).toEqual({ groupsProcessed: 1, emailsSent: 1, emailsFailed: 1, skipped: 0 });
    expect(emailProvider.send).toHaveBeenCalledTimes(2);
  });
});
