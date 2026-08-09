import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminRolesGuard } from '../auth/guards/admin-roles.guard';
import { AdminRoles } from '../auth/decorators/admin-roles.decorator';
import { AdminAnalyticsService } from './admin-analytics.service';

@ApiTags('admin-analytics')
@ApiBearerAuth('admin-auth')
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly adminAnalyticsService: AdminAnalyticsService) {}

  @Get('overview')
  @AdminRoles('super_admin', 'ops_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'Top-level platform overview metrics (DAU, MAU, volume, time-to-settle)' })
  getOverviewMetrics() {
    return this.adminAnalyticsService.getOverviewMetrics();
  }

  @Get('funnels')
  @AdminRoles('super_admin', 'ops_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'Activation funnel metrics' })
  getActivationFunnels() {
    return this.adminAnalyticsService.getActivationFunnels();
  }

  @Get('revenue-tile')
  @AdminRoles('super_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'Revenue tile cluster (MRR, ARR, Churn, ARPU, LTV)' })
  getRevenueTileCluster() {
    return this.adminAnalyticsService.getRevenueTileCluster();
  }
}
