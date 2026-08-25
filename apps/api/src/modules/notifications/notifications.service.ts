import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreferencesEntity } from '../users/entities/user-preferences.entity';
import { NOTIFICATION_PROVIDER } from './notifications.constants';
import { NotificationDeliveryEntity } from './entities/notification-delivery.entity';
import { NotificationEntity, NotificationTone } from './entities/notification.entity';
import { NotificationProviderPort } from './ports/notification-provider.port';
import { DeviceInstallationsService } from './device-installations.service';
import { preferenceAllowsPushType } from './notification-preferences';

interface CreateNotificationInput {
  userId: string;
  groupId?: string | null;
  type: string;
  title: string;
  body: string;
  tone?: NotificationTone;
  data?: Record<string, unknown>;
  deliver?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notifications: Repository<NotificationEntity>,
    @InjectRepository(NotificationDeliveryEntity)
    private readonly deliveries: Repository<NotificationDeliveryEntity>,
    @InjectRepository(UserPreferencesEntity)
    private readonly preferences: Repository<UserPreferencesEntity>,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly provider: NotificationProviderPort,
    private readonly devices: DeviceInstallationsService
  ) {}

  async create(input: CreateNotificationInput): Promise<NotificationEntity> {
    const notification = await this.notifications.save(
      this.notifications.create({
        userId: input.userId,
        groupId: input.groupId ?? null,
        type: input.type,
        title: input.title,
        body: input.body,
        tone: input.tone ?? 'neutral',
        data: input.data ?? {},
        readAt: null
      })
    );

    if (input.deliver !== false) {
      await this.deliver(notification);
    }

    return notification;
  }

  async listForUser(userId: string): Promise<NotificationEntity[]> {
    return this.notifications.find({
      where: { userId },
      order: { createdAt: 'DESC' }
    });
  }

  async broadcastAppUpdate(versionName: string, releaseNotes?: string, directApkUrl?: string) {
    const allTokens = await this.devices.listAllPushTokens();
    if (allTokens.length === 0) {
      return { status: 'skipped', message: 'No devices registered for push notifications.' };
    }

    const apkUrl = directApkUrl || 'https://api.thesplitsaathi.com/downloads/SplitSaathi.apk';

    return this.provider.deliver({
      notificationId: 'app-update-broadcast',
      userId: 'system',
      type: 'APP_UPDATE',
      title: 'New Update Available! 🎉',
      body: `SplitSaathi v${versionName} is ready. Tap to download the latest features!`,
      data: {
        type: 'APP_UPDATE',
        versionName,
        releaseNotes: releaseNotes ?? '',
        directApkUrl: apkUrl
      },
      targetPushTokens: allTokens
    });
  }

  private async deliver(notification: NotificationEntity): Promise<void> {
    const prefs = await this.preferences.findOne({ where: { userId: notification.userId } });
    if (!preferenceAllowsPushType(prefs, notification.type)) {
      await this.deliveries.save(
        this.deliveries.create({
          notificationId: notification.id,
          channel: 'push',
          provider: 'skipped',
          status: 'skipped',
          providerMessageId: null,
          error: prefs?.pushNotificationsEnabled === false ? 'pushNotificationsEnabled=false' : `preference_disabled:${notification.type}`,
          deliveredAt: null
        })
      );
      return;
    }

    const targetPushTokens = await this.devices.listPushTokens(notification.userId);
    const result = await this.provider.deliver({
      notificationId: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      targetPushTokens
    });

    await this.deliveries.save(
      this.deliveries.create({
        notificationId: notification.id,
        channel: 'push',
        provider: result.provider,
        status: result.status,
        providerMessageId: result.providerMessageId ?? null,
        error: result.error ?? null,
        deliveredAt: result.status === 'sent' ? new Date() : null
      })
    );
  }
}
