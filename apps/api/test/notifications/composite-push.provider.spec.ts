import { CompositePushProvider } from '../../src/modules/notifications/providers/composite-push.provider';

describe('CompositePushProvider', () => {
  it('routes native and Expo tokens to the matching providers', async () => {
    const fcm = {
      deliver: jest.fn(async () => ({ provider: 'fcm', status: 'sent' as const }))
    };
    const expo = {
      deliver: jest.fn(async () => ({ provider: 'expo', status: 'queued' as const }))
    };
    const provider = new CompositePushProvider(fcm as any, expo as any);

    const result = await provider.deliver({
      notificationId: 'n1',
      userId: 'u1',
      type: 'participant_added',
      title: 'New member joined',
      body: 'Someone joined',
      targetPushTokens: ['native-fcm-token', 'ExponentPushToken[abc]']
    });

    expect(fcm.deliver).toHaveBeenCalledWith(
      expect.objectContaining({ targetPushTokens: ['native-fcm-token'] })
    );
    expect(expo.deliver).toHaveBeenCalledWith(
      expect.objectContaining({ targetPushTokens: ['ExponentPushToken[abc]'] })
    );
    expect(result.status).toBe('sent');
  });
});
