import { Injectable } from '@nestjs/common';
import type {
  NotificationDeliveryInput,
  NotificationDeliveryResult,
  NotificationProviderPort
} from '../ports/notification-provider.port';
import { ExpoPushProvider } from './expo-push.provider';
import { FcmPushProvider } from './fcm-push.provider';

function isExpoPushToken(token: string): boolean {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

@Injectable()
export class CompositePushProvider implements NotificationProviderPort {
  constructor(
    private readonly fcm: FcmPushProvider,
    private readonly expo: ExpoPushProvider
  ) {}

  async deliver(input: NotificationDeliveryInput): Promise<NotificationDeliveryResult> {
    const tokens = input.targetPushTokens ?? [];
    if (tokens.length === 0) {
      return { provider: 'composite', status: 'skipped', error: 'No registered push tokens.' };
    }

    const expoTokens = tokens.filter(isExpoPushToken);
    const fcmTokens = tokens.filter((token) => !isExpoPushToken(token));
    const results: NotificationDeliveryResult[] = [];

    if (fcmTokens.length > 0) {
      results.push(await this.fcm.deliver({ ...input, targetPushTokens: fcmTokens }));
    }
    if (expoTokens.length > 0) {
      results.push(await this.expo.deliver({ ...input, targetPushTokens: expoTokens }));
    }

    const sent = results.find((row) => row.status === 'sent' || row.status === 'queued');
    if (sent) {
      return {
        provider: 'composite',
        status: sent.status,
        providerMessageId: results
          .map((row) => row.providerMessageId)
          .filter(Boolean)
          .join(','),
        error: results
          .filter((row) => row.status === 'failed')
          .map((row) => row.error)
          .filter(Boolean)
          .join('; ') || undefined
      };
    }

    return (
      results[0] ?? {
        provider: 'composite',
        status: 'failed',
        error: 'Push delivery failed for all token types.'
      }
    );
  }
}
