import { Body, Controller, Get, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminRolesGuard } from '../auth/guards/admin-roles.guard';
import { AdminRoles } from '../auth/decorators/admin-roles.decorator';
import { CurrentAdmin, AuthenticatedAdmin } from '../auth/decorators/current-admin.decorator';
import { AdminAuditInterceptor } from '../audit-log/interceptors/admin-audit.interceptor';
import { AdminNotificationsService, BroadcastNotificationPayload } from './admin-notifications.service';

@ApiTags('admin-notifications')
@ApiBearerAuth('admin-auth')
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly adminNotificationsService: AdminNotificationsService) {}

  @Post('broadcast')
  @AdminRoles('super_admin', 'ops_admin')
  @ApiOkResponse({ description: 'Broadcast push/in-app notification to users' })
  broadcastNotification(
    @Body() payload: BroadcastNotificationPayload,
    @CurrentAdmin() admin: AuthenticatedAdmin
  ) {
    return this.adminNotificationsService.broadcastNotification(payload, admin.adminId);
  }

  @Get('history')
  @AdminRoles('super_admin', 'ops_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'View past broadcast notification campaign history' })
  getNotificationHistory() {
    return this.adminNotificationsService.getNotificationHistory();
  }
}
