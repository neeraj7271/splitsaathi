import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAppConfigEntity } from '@splitsaathi/db';
import { AdminModule } from '../admin/admin.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AppVersionController } from './app-version.controller';
import { AppVersionService } from './app-version.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminAppConfigEntity]),
    NotificationsModule,
    AdminModule
  ],
  controllers: [AppVersionController],
  providers: [AppVersionService],
  exports: [AppVersionService]
})
export class AppVersionModule {}
