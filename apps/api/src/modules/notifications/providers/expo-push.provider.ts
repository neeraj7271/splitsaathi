import { Inject, Injectable, Optional } from '@nestjs/common';
import { ApiConfigService } from '../../../config/api-config.service';
import type { NotificationDeliveryInput, NotificationDeliveryResult, NotificationProviderPort } from '../ports/notification-provider.port';

type FetchLike = (input: string, init: RequestInit) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<Record<string, unknown>>;
}>;

export const EXPO_PUSH_FETCH = Symbol('EXPO_PUSH_FETCH');

@Injectable()
export class ExpoPushProvider implements NotificationProviderPort {
  private readonly fetchFn: FetchLike;

  constructor(
    private readonly config: ApiConfigService,
    @Optional() @Inject(EXPO_PUSH_FETCH) fetchFn?: FetchLike
  ) {
    this.fetchFn = fetchFn ?? (fetch as FetchLike);
  }

  async deliver(input: NotificationDeliveryInput): Promise<NotificationDeliveryResult> {
    const tokens = input.targetPushTokens ?? [];
    if (tokens.length === 0) {
      return { provider: 'expo', status: 'skipped', error: 'No registered Expo push tokens.' };
    }
    const response = await this.fetchFn('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.env.EXPO_PUSH_ACCESS_TOKEN
          ? { Authorization: `Bearer ${this.config.env.EXPO_PUSH_ACCESS_TOKEN}` }
          : {})
      },
      body: JSON.stringify(
        tokens.map((to) => ({
          to,
          title: input.title,
          body: input.body,
          data: { ...input.data, notificationId: input.notificationId, type: input.type }
        }))
      )
    });
    const payload = await response.json();
    if (!response.ok) {
      return {
        provider: 'expo',
        status: 'failed',
        error: `Expo Push failed (${response.status}): ${JSON.stringify(payload)}`
      };
    }
    return {
      provider: 'expo',
      status: 'queued',
      providerMessageId: extractTicketId(payload)
    };
  }
}

function extractTicketId(payload: Record<string, unknown>): string | undefined {
  const data = payload.data;
  if (Array.isArray(data)) {
    return data.map((row: any) => row.id).filter(Boolean).join(',') || undefined;
  }
  return undefined;
}
