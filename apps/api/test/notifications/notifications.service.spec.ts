import { NotificationsService } from '../../src/modules/notifications/notifications.service';

describe('NotificationsService.deliver prefs', () => {
  function buildService(prefs: Partial<{ pushNotificationsEnabled: boolean; emailExpenseAdded: boolean }> | null) {
    const notifications = {
      create: jest.fn((input: any) => ({ id: 'n1', ...input })),
      save: jest.fn(async (row: any) => row),
      find: jest.fn()
    };
    const deliveries: any[] = [];
    const deliveryRepo = {
      create: jest.fn((input: any) => input),
      save: jest.fn(async (row: any) => {
        deliveries.push(row);
        return row;
      })
    };
    const preferences = {
      findOne: jest.fn(async () => prefs)
    };
    const provider = {
      deliver: jest.fn(async () => ({
        provider: 'dev',
        status: 'sent' as const,
        providerMessageId: 'dev-n1'
      }))
    };
    const devices = {
      listPushTokens: jest.fn(async () => ['ExponentPushToken[test]'])
    };

    const service = new NotificationsService(
      notifications as any,
      deliveryRepo as any,
      preferences as any,
      provider as any,
      devices as any
    );

    return { service, provider, deliveries, devices };
  }

  it('still stores in-app notification but skips push when pushNotificationsEnabled is false', async () => {
    const { service, provider, deliveries, devices } = buildService({ pushNotificationsEnabled: false });

    await service.create({
      userId: 'u1',
      type: 'expense_created',
      title: 'New expense',
      body: 'Someone added an expense'
    });

    expect(provider.deliver).not.toHaveBeenCalled();
    expect(devices.listPushTokens).not.toHaveBeenCalled();
    expect(deliveries).toEqual([
      expect.objectContaining({
        notificationId: 'n1',
        provider: 'skipped',
        status: 'skipped'
      })
    ]);
  });

  it('delivers push when pushNotificationsEnabled is true', async () => {
    const { service, provider } = buildService({ pushNotificationsEnabled: true });

    await service.create({
      userId: 'u1',
      type: 'expense_created',
      title: 'New expense',
      body: 'Someone added an expense'
    });

    expect(provider.deliver).toHaveBeenCalledTimes(1);
  });

  it('skips push when emailExpenseAdded is false', async () => {
    const { service, provider } = buildService({ pushNotificationsEnabled: true, emailExpenseAdded: false });

    await service.create({
      userId: 'u1',
      type: 'expense_created',
      title: 'New expense',
      body: 'Someone added an expense'
    });

    expect(provider.deliver).not.toHaveBeenCalled();
  });
});
