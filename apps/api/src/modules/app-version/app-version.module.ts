import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AppVersionController } from './app-version.controller';
import { AppVersionService } from './app-version.service';

@Module({
  imports: [NotificationsModule],
  controllers: [AppVersionController],
  providers: [AppVersionService],
  exports: [AppVersionService]
})
export class AppVersionModule {}
