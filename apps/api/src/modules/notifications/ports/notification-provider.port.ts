export interface NotificationDeliveryInput {
  notificationId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  targetPushTokens?: string[];
}

export interface NotificationDeliveryResult {
  provider: string;
  status: 'sent' | 'queued' | 'skipped' | 'failed';
  providerMessageId?: string;
  error?: string;
}

export interface NotificationProviderPort {
  deliver(input: NotificationDeliveryInput): Promise<NotificationDeliveryResult>;
}
