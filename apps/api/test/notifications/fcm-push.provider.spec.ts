import { FcmPushProvider } from '../../src/modules/notifications/providers/fcm-push.provider';

describe('FcmPushProvider', () => {
  it('sends multicast notification+data via FCM messaging', async () => {
    const messaging = {
      sendEachForMulticast: jest.fn(async () => ({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true, messageId: 'projects/demo/messages/1' }]
      }))
    };
    const provider = new FcmPushProvider({ env: {} } as any, messaging as any);

    const result = await provider.deliver({
      notificationId: 'n1',
      userId: 'u1',
      type: 'settlement_reminder',
      title: 'Pay up',
      body: 'You owe someone',
      data: { groupId: 'g1', amount: 12 },
      targetPushTokens: ['token-1']
    });

    expect(messaging.sendEachForMulticast).toHaveBeenCalledWith({
      tokens: ['token-1'],
      notification: { title: 'Pay up', body: 'You owe someone' },
      data: {
        groupId: 'g1',
        amount: '12',
        notificationId: 'n1',
        type: 'settlement_reminder'
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'default',
          priority: 'high',
          defaultSound: true
        }
      }
    });
    expect(result).toEqual({
      provider: 'fcm',
      status: 'sent',
      providerMessageId: 'projects/demo/messages/1',
      error: undefined
    });
  });

  it('skips when there are no push tokens', async () => {
    const messaging = { sendEachForMulticast: jest.fn() };
    const provider = new FcmPushProvider({ env: {} } as any, messaging as any);

    const result = await provider.deliver({
      notificationId: 'n1',
      userId: 'u1',
      type: 'settlement_reminder',
      title: 'Pay up',
      body: 'You owe someone',
      targetPushTokens: []
    });

    expect(messaging.sendEachForMulticast).not.toHaveBeenCalled();
    expect(result).toEqual({
      provider: 'fcm',
      status: 'skipped',
      error: 'No registered FCM push tokens.'
    });
  });
});
