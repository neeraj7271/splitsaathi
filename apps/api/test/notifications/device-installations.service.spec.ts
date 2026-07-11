import { DeviceInstallationsService } from '../../src/modules/notifications/device-installations.service';

describe('DeviceInstallationsService', () => {
  it('upserts push-token registrations and lists active tokens', async () => {
    const rows: any[] = [];
    const repository = {
      findOne: jest.fn(async ({ where }: any) => rows.find((row) => row.userId === where.userId && row.pushToken === where.pushToken)),
      create: jest.fn((input: any) => ({ id: `device-${rows.length + 1}`, ...input })),
      save: jest.fn(async (row: any) => {
        const existingIndex = rows.findIndex((candidate) => candidate.id === row.id);
        if (existingIndex >= 0) {
          rows[existingIndex] = row;
        } else {
          rows.push(row);
        }
        return row;
      }),
      find: jest.fn(async ({ where }: any) => rows.filter((row) => row.userId === where.userId))
    };
    const service = new DeviceInstallationsService(repository as any);

    await service.register({
      userId: 'user-1',
      platform: 'android',
      appVersion: '1.0.0',
      pushToken: 'ExponentPushToken[test]'
    });
    await service.register({
      userId: 'user-1',
      platform: 'android',
      appVersion: '1.0.1',
      pushToken: 'ExponentPushToken[test]'
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].appVersion).toBe('1.0.1');
    await expect(service.listPushTokens('user-1')).resolves.toEqual(['ExponentPushToken[test]']);
  });
});
