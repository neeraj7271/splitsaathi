import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationDeliveryInput,
  NotificationDeliveryResult,
  NotificationProviderPort
} from '../ports/notification-provider.port';

@Injectable()
export class DevNotificationProvider implements NotificationProviderPort {
  private readonly logger = new Logger(DevNotificationProvider.name);

  async deliver(input: NotificationDeliveryInput): Promise<NotificationDeliveryResult> {
    this.logger.log(
      `Development notification user=${input.userId} type=${input.type} title="${input.title}"`
    );

    return {
      provider: 'dev',
      status: 'sent',
      providerMessageId: `dev-${input.notificationId}`
    };
  }
}
