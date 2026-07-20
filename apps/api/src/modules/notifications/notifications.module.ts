import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiConfigModule } from '../../config/api-config.module';
import { ApiConfigService } from '../../config/api-config.service';
import { DeviceInstallationEntity } from '@splitsaathi/db';
import { DeviceInstallationsController } from './device-installations.controller';
import { DeviceInstallationsService } from './device-installations.service';
import { NotificationDeliveryEntity } from './entities/notification-delivery.entity';
import { NotificationEntity } from './entities/notification.entity';
import { NOTIFICATION_PROVIDER } from './notifications.constants';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { DevNotificationProvider } from './providers/dev-notification.provider';
import { ExpoPushProvider } from './providers/expo-push.provider';

@Module({
  imports: [
    ApiConfigModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([NotificationEntity, NotificationDeliveryEntity, DeviceInstallationEntity])
  ],
  controllers: [NotificationsController, DeviceInstallationsController],
  providers: [
    NotificationsService,
    DeviceInstallationsService,
    JwtAuthGuard,
    DevNotificationProvider,
    ExpoPushProvider,
    {
      provide: NOTIFICATION_PROVIDER,
      inject: [ApiConfigService, DevNotificationProvider, ExpoPushProvider],
      useFactory: (config: ApiConfigService, dev: DevNotificationProvider, expo: ExpoPushProvider) => {
        if (
          config.env.NODE_ENV === 'production' &&
          config.env.NOTIFICATION_PROVIDER_DRIVER === 'dev' &&
          !config.env.ALLOW_INSECURE_DEV_PROVIDERS
        ) {
          throw new Error('NOTIFICATION_PROVIDER_DRIVER=dev is not allowed in production.');
        }
        return config.env.NOTIFICATION_PROVIDER_DRIVER === 'expo' ? expo : dev;
      }
    }
  ],
  exports: [NotificationsService, DeviceInstallationsService, TypeOrmModule]
})
export class NotificationsModule {}
