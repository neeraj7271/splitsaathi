import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { readFileSync } from 'fs';
import { cert, getApps, initializeApp, type App, type ServiceAccount } from 'firebase-admin/app';
import {
  getMessaging,
  type BatchResponse,
  type Messaging,
  type SendResponse
} from 'firebase-admin/messaging';
import { ApiConfigService } from '../../../config/api-config.service';
import type {
  NotificationDeliveryInput,
  NotificationDeliveryResult,
  NotificationProviderPort
} from '../ports/notification-provider.port';

export const FCM_MESSAGING = Symbol('FCM_MESSAGING');

type FcmMessaging = Pick<Messaging, 'sendEachForMulticast'>;

@Injectable()
export class FcmPushProvider implements NotificationProviderPort {
  private readonly logger = new Logger(FcmPushProvider.name);
  private messaging: FcmMessaging | null;

  constructor(
    private readonly config: ApiConfigService,
    @Optional() @Inject(FCM_MESSAGING) messaging?: FcmMessaging | null
  ) {
    this.messaging = messaging === undefined ? null : messaging;
  }

  async deliver(input: NotificationDeliveryInput): Promise<NotificationDeliveryResult> {
    const tokens = input.targetPushTokens ?? [];
    if (tokens.length === 0) {
      return { provider: 'fcm', status: 'skipped', error: 'No registered FCM push tokens.' };
    }

    const messaging = this.getMessaging();
    if (!messaging) {
      return {
        provider: 'fcm',
        status: 'failed',
        error: 'FCM is not configured. Set FCM_SERVICE_ACCOUNT_JSON or FCM_SERVICE_ACCOUNT_PATH.'
      };
    }

    const data = stringifyData({
      ...(input.data ?? {}),
      notificationId: input.notificationId,
      type: input.type
    });

    try {
      const response: BatchResponse = await messaging.sendEachForMulticast({
        tokens,
        notification: {
          title: input.title,
          body: input.body
        },
        data,
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
            priority: 'high',
            defaultSound: true
          }
        }
      });

      const messageIds = response.responses
        .map((row: SendResponse) => row.messageId)
        .filter((id): id is string => Boolean(id));
      const errors = response.responses
        .filter((row: SendResponse) => !row.success)
        .map((row: SendResponse) => row.error?.message)
        .filter((msg): msg is string => Boolean(msg));

      if (response.failureCount === tokens.length) {
        return {
          provider: 'fcm',
          status: 'failed',
          error: errors.join('; ') || 'All FCM deliveries failed.'
        };
      }

      if (response.failureCount > 0) {
        this.logger.warn(
          `FCM partial failure notification=${input.notificationId} success=${response.successCount} failure=${response.failureCount}`
        );
      }

      return {
        provider: 'fcm',
        status: 'sent',
        providerMessageId: messageIds.join(',') || undefined,
        error: errors.length > 0 ? errors.join('; ') : undefined
      };
    } catch (error) {
      return {
        provider: 'fcm',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private getMessaging(): FcmMessaging | null {
    if (this.messaging) {
      return this.messaging;
    }

    const serviceAccount = this.loadServiceAccount();
    if (!serviceAccount) {
      return null;
    }

    const existing: App | undefined = getApps()[0];
    const app =
      existing ??
      initializeApp({
        credential: cert(serviceAccount),
        projectId: this.config.env.FCM_PROJECT_ID
      });
    this.messaging = getMessaging(app);
    return this.messaging;
  }

  private loadServiceAccount(): ServiceAccount | null {
    const json = this.config.env.FCM_SERVICE_ACCOUNT_JSON?.trim();
    if (json) {
      return JSON.parse(json) as ServiceAccount;
    }

    const path = this.config.env.FCM_SERVICE_ACCOUNT_PATH?.trim();
    if (path) {
      return JSON.parse(readFileSync(path, 'utf8')) as ServiceAccount;
    }

    return null;
  }
}

function stringifyData(data: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) {
      continue;
    }
    out[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return out;
}
