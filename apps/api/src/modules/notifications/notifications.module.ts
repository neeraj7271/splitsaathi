import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiConfigModule } from '../../config/api-config.module';
import { ApiConfigService } from '../../config/api-config.service';
import { DeviceInstallationEntity } from '@splitsaathi/db';
import { UsersModule } from '../users/users.module';
import { DeviceInstallationsController } from './device-installations.controller';
import { DeviceInstallationsService } from './device-installations.service';
import { NotificationDeliveryEntity } from './entities/notification-delivery.entity';
import { NotificationEntity } from './entities/notification.entity';
import { NOTIFICATION_PROVIDER } from './notifications.constants';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { DevNotificationProvider } from './providers/dev-notification.provider';
import { ExpoPushProvider } from './providers/expo-push.provider';
import { FcmPushProvider } from './providers/fcm-push.provider';
import { CompositePushProvider } from './providers/composite-push.provider';

@Module({
  imports: [
    ApiConfigModule,
    JwtModule.register({}),
    UsersModule,
    TypeOrmModule.forFeature([NotificationEntity, NotificationDeliveryEntity, DeviceInstallationEntity])
  ],
  controllers: [NotificationsController, DeviceInstallationsController],
  providers: [
    NotificationsService,
    DeviceInstallationsService,
    JwtAuthGuard,
    DevNotificationProvider,
    ExpoPushProvider,
    FcmPushProvider,
    CompositePushProvider,
    {
      provide: NOTIFICATION_PROVIDER,
      inject: [ApiConfigService, DevNotificationProvider, ExpoPushProvider, FcmPushProvider, CompositePushProvider],
      useFactory: (
        config: ApiConfigService,
        dev: DevNotificationProvider,
        expo: ExpoPushProvider,
        fcm: FcmPushProvider,
        composite: CompositePushProvider
      ) => {
        if (
          config.env.NODE_ENV === 'production' &&
          config.env.NOTIFICATION_PROVIDER_DRIVER === 'dev' &&
          !config.env.ALLOW_INSECURE_DEV_PROVIDERS
        ) {
          throw new Error('NOTIFICATION_PROVIDER_DRIVER=dev is not allowed in production.');
        }
        if (config.env.NOTIFICATION_PROVIDER_DRIVER === 'expo') {
          return expo;
        }
        if (config.env.NOTIFICATION_PROVIDER_DRIVER === 'fcm') {
          return composite;
        }
        return dev;
      }
    }
  ],
  exports: [NotificationsService, DeviceInstallationsService, TypeOrmModule]
})
export class NotificationsModule {}
