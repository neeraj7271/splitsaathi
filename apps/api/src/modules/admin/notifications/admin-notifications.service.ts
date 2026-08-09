import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity, DeviceInstallationEntity } from '@splitsaathi/db';

export interface BroadcastNotificationPayload {
  title: string;
  body: string;
  targetCohort?: 'all' | 'active_this_week' | 'has_unsettled_debts';
  tone?: 'neutral' | 'urgent' | 'system';
}

@Injectable()
export class AdminNotificationsService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepo: Repository<NotificationEntity>,
    @InjectRepository(DeviceInstallationEntity)
    private readonly deviceRepo: Repository<DeviceInstallationEntity>
  ) {}

  async broadcastNotification(payload: BroadcastNotificationPayload, _adminId: string) {
    const devices = await this.deviceRepo.find();
    const registeredUserIds = Array.from(
      new Set(devices.map((d) => d.userId).filter((id): id is string => Boolean(id)))
    );

    const notificationsToSave = registeredUserIds.map((userId) =>
      this.notificationRepo.create({
        userId,
        type: 'broadcast_announcement',
        title: payload.title,
        body: payload.body,
        tone: payload.tone || 'neutral'
      })
    );

    if (notificationsToSave.length > 0) {
      await this.notificationRepo.save(notificationsToSave);
    }

    return {
      success: true,
      recipientsCount: registeredUserIds.length,
      message: `Broadcast queued successfully to ${registeredUserIds.length} users.`
    };
  }

  async getNotificationHistory() {
    const broadcasts = await this.notificationRepo.find({
      where: { type: 'broadcast_announcement' },
      order: { createdAt: 'DESC' },
      take: 50
    });

    return broadcasts.map((b) => ({
      id: b.id,
      title: b.title,
      body: b.body,
      tone: b.tone,
      createdAt: b.createdAt.toISOString()
    }));
  }
}
