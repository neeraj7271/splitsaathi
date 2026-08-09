import { Body, Controller, Get, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminRolesGuard } from '../auth/guards/admin-roles.guard';
import { AdminRoles } from '../auth/decorators/admin-roles.decorator';
import { CurrentAdmin, AuthenticatedAdmin } from '../auth/decorators/current-admin.decorator';
import { AdminAuditInterceptor } from '../audit-log/interceptors/admin-audit.interceptor';
import { AdminSubscriptionsService } from './admin-subscriptions.service';

@ApiTags('admin-subscriptions')
@ApiBearerAuth('admin-auth')
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@Controller('admin/subscriptions')
export class AdminSubscriptionsController {
  constructor(private readonly adminSubscriptionsService: AdminSubscriptionsService) {}

  @Get()
  @AdminRoles('super_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'Subscriber list' })
  listSubscriptions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('planId') planId?: string
  ) {
    return this.adminSubscriptionsService.listSubscriptions({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
      planId
    });
  }

  @Get('plans')
  @AdminRoles('super_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'Billing plan catalog' })
  listPlans() {
    return this.adminSubscriptionsService.listPlans();
  }

  @Get('revenue-summary')
  @AdminRoles('super_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'MRR/ARR revenue dashboard overview' })
  getRevenueSummary() {
    return this.adminSubscriptionsService.getRevenueSummary();
  }

  @Get('cohorts')
  @AdminRoles('super_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'Subscriber cohort retention curves' })
  getCohortRetention() {
    return this.adminSubscriptionsService.getCohortRetention();
  }

  @Post('refund')
  @AdminRoles('super_admin', 'finance_admin')
  @ApiOkResponse({ description: 'Process subscription refund or credit' })
  processRefund(
    @Body('userId') userId: string,
    @Body('amountMinor') amountMinor: string,
    @Body('reason') reason: string,
    @CurrentAdmin() admin: AuthenticatedAdmin
  ) {
    return this.adminSubscriptionsService.processRefund(userId, amountMinor, reason, admin.adminId);
  }
}
