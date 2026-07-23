import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreferencesEntity } from '../users/entities/user-preferences.entity';
import { NOTIFICATION_PROVIDER } from './notifications.constants';
import { NotificationDeliveryEntity } from './entities/notification-delivery.entity';
import { NotificationEntity, NotificationTone } from './entities/notification.entity';
import { NotificationProviderPort } from './ports/notification-provider.port';
import { DeviceInstallationsService } from './device-installations.service';

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

/** Maps notification types to per-event preference toggles (UI "Email settings" / notification prefs). */
function preferenceAllowsType(prefs: UserPreferencesEntity | null, type: string): boolean {
  if (!prefs) {
    // Missing row → allow (DB defaults); expense_added defaults false in DB historically,
    // but treat missing prefs as allow so first-time users still get critical alerts.
    return true;
  }
  if (prefs.pushNotificationsEnabled === false) {
    return false;
  }

  switch (type) {
    case 'expense_created':
      // Prefer explicit opt-in; treat unset as enabled after prefs defaults migration.
      return prefs.emailExpenseAdded !== false;
    case 'expense_revised':
    case 'expense_voided':
      return prefs.emailExpenseEdited !== false;
    case 'settlement_confirmation_requested':
    case 'settlement_awaiting_confirmation':
    case 'settlement_confirmed':
    case 'settlement_received_confirmed':
    case 'settlement_rejected':
    case 'settlement_disputed':
      return prefs.emailPaymentReceived !== false;
    case 'participant_added':
    case 'invite_claimed':
    case 'group_archived':
    case 'group_unarchived':
    case 'membership_removed':
    case 'membership_role_changed':
    case 'membership_exit_locked':
    case 'membership_exit_unlocked':
      return prefs.emailGroupAdded !== false;
    case 'contact_joined':
      return prefs.emailFriendAdded !== false;
    case 'friend_payment_reminder':
      return prefs.emailExpenseDue !== false;
    case 'reminder_settlement_day':
    case 'reminder_recurring_expense':
    case 'reminder_stale_proof':
      return prefs.emailExpenseDue !== false;
    default:
      return true;
  }
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

  private async deliver(notification: NotificationEntity): Promise<void> {
    const prefs = await this.preferences.findOne({ where: { userId: notification.userId } });
    if (!preferenceAllowsType(prefs, notification.type)) {
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
