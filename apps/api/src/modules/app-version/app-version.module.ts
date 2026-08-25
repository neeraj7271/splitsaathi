import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAppConfigEntity } from '@splitsaathi/db';
import { ApiConfigModule } from '../../config/api-config.module';
import { AdminJwtAuthGuard } from '../admin/auth/guards/admin-jwt-auth.guard';
import { AdminRolesGuard } from '../admin/auth/guards/admin-roles.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { AppVersionController } from './app-version.controller';
import { AppVersionService } from './app-version.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminAppConfigEntity]),
    NotificationsModule,
    ApiConfigModule,
    JwtModule.register({})
  ],
  controllers: [AppVersionController],
  providers: [AppVersionService, AdminJwtAuthGuard, AdminRolesGuard],
  exports: [AppVersionService]
})
export class AppVersionModule {}
