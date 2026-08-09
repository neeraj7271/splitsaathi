import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ApiConfigModule } from '../../config/api-config.module';
import {
  AdminUserEntity,
  AdminRefreshSessionEntity,
  AdminAuditLogEntity,
  AdminSupportTicketEntity,
  AdminSupportMessageEntity,
  AdminFeatureFlagEntity,
  AdminAppConfigEntity,
  AdminEventEntity,
  BillingPlanEntity,
  SubscriptionEntity,
  UserEntity,
  GroupEntity,
  GroupMembershipEntity,
  ParticipantEntity,
  ExpenseProjectionEntity,
  ExpenseVersionProjectionEntity,
  SettlementIntentEntity,
  PaymentProofEntity,
  UpiPaymentReferenceEntity,
  UpiAppOpenEventEntity,
  SettlementConfirmationEntity,
  NotificationEntity,
  DeviceInstallationEntity,
  ImportJobEntity,
  ExportJobEntity,
  AuditLogEntryEntity,
  RefreshSessionEntity
} from '@splitsaathi/db';

import { AdminAuthController } from './auth/admin-auth.controller';
import { AdminAuthService } from './auth/admin-auth.service';
import { AdminJwtAuthGuard } from './auth/guards/admin-jwt-auth.guard';
import { AdminRolesGuard } from './auth/guards/admin-roles.guard';

import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersService } from './users/admin-users.service';

import { AdminGroupsController } from './groups/admin-groups.controller';
import { AdminGroupsService } from './groups/admin-groups.service';

import { AdminFinancialController } from './financial/admin-financial.controller';
import { AdminFinancialService } from './financial/admin-financial.service';

import { AdminSubscriptionsController } from './subscriptions/admin-subscriptions.controller';
import { AdminSubscriptionsService } from './subscriptions/admin-subscriptions.service';

import { AdminSupportController } from './support/admin-support.controller';
import { AdminSupportService } from './support/admin-support.service';

import { AdminConfigFlagsController } from './config-flags/admin-config-flags.controller';
import { AdminConfigFlagsService } from './config-flags/admin-config-flags.service';

import { AdminNotificationsController } from './notifications/admin-notifications.controller';
import { AdminNotificationsService } from './notifications/admin-notifications.service';

import { AdminAnalyticsController } from './analytics/admin-analytics.controller';
import { AdminAnalyticsService } from './analytics/admin-analytics.service';

import { AdminAuditLogController } from './audit-log/admin-audit-log.controller';
import { AdminAuditLogService } from './audit-log/admin-audit-log.service';
import { AdminAuditInterceptor } from './audit-log/interceptors/admin-audit.interceptor';

import { AdminManagementController } from './management/admin-management.controller';
import { AdminManagementService } from './management/admin-management.service';

import { AdminReportsController } from './reports/admin-reports.controller';
import { AdminReportsService } from './reports/admin-reports.service';

@Module({
  imports: [
    ApiConfigModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([
      AdminUserEntity,
      AdminRefreshSessionEntity,
      AdminAuditLogEntity,
      AdminSupportTicketEntity,
      AdminSupportMessageEntity,
      AdminFeatureFlagEntity,
      AdminAppConfigEntity,
      AdminEventEntity,
      BillingPlanEntity,
      SubscriptionEntity,
      UserEntity,
      GroupEntity,
      GroupMembershipEntity,
      ParticipantEntity,
      ExpenseProjectionEntity,
      ExpenseVersionProjectionEntity,
      SettlementIntentEntity,
      PaymentProofEntity,
      UpiPaymentReferenceEntity,
      UpiAppOpenEventEntity,
      SettlementConfirmationEntity,
      NotificationEntity,
      DeviceInstallationEntity,
      ImportJobEntity,
      ExportJobEntity,
      AuditLogEntryEntity,
      RefreshSessionEntity
    ])
  ],
  controllers: [
    AdminAuthController,
    AdminUsersController,
    AdminGroupsController,
    AdminFinancialController,
    AdminSubscriptionsController,
    AdminSupportController,
    AdminConfigFlagsController,
    AdminNotificationsController,
    AdminAnalyticsController,
    AdminReportsController,
    AdminAuditLogController,
    AdminManagementController
  ],
  providers: [
    AdminAuthService,
    AdminJwtAuthGuard,
    AdminRolesGuard,
    AdminUsersService,
    AdminGroupsService,
    AdminFinancialService,
    AdminSubscriptionsService,
    AdminSupportService,
    AdminConfigFlagsService,
    AdminNotificationsService,
    AdminAnalyticsService,
    AdminReportsService,
    AdminAuditLogService,
    AdminAuditInterceptor,
    AdminManagementService
  ],
  exports: [
    AdminAuthService,
    AdminJwtAuthGuard,
    AdminRolesGuard,
    AdminAuditLogService
  ]
})
export class AdminModule {}
