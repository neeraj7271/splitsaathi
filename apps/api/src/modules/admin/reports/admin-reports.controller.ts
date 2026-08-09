import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminRolesGuard } from '../auth/guards/admin-roles.guard';
import { AdminRoles } from '../auth/decorators/admin-roles.decorator';
import { AdminReportsService } from './admin-reports.service';

@ApiTags('admin-reports')
@ApiBearerAuth('admin-auth')
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@Controller('admin/reports')
export class AdminReportsController {
  constructor(private readonly adminReportsService: AdminReportsService) {}

  @Get('growth')
  @AdminRoles('super_admin', 'ops_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'Growth and user acquisition report' })
  getGrowthReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('preset') preset?: string
  ) {
    return this.adminReportsService.getGrowthReport({ startDate, endDate, preset });
  }

  @Get('engagement')
  @AdminRoles('super_admin', 'ops_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'Engagement and cohort retention report' })
  getEngagementReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('preset') preset?: string
  ) {
    return this.adminReportsService.getEngagementReport({ startDate, endDate, preset });
  }

  @Get('financial')
  @AdminRoles('super_admin', 'ops_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'Financial ledger report' })
  getFinancialReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('preset') preset?: string
  ) {
    return this.adminReportsService.getFinancialReport({ startDate, endDate, preset });
  }

  @Get('revenue')
  @AdminRoles('super_admin', 'ops_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'Revenue and subscriber report' })
  getRevenueReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('preset') preset?: string
  ) {
    return this.adminReportsService.getRevenueReport({ startDate, endDate, preset });
  }

  @Get('group-types')
  @AdminRoles('super_admin', 'ops_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'Group mode and usage breakdown report' })
  getGroupTypeReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('preset') preset?: string
  ) {
    return this.adminReportsService.getGroupTypeReport({ startDate, endDate, preset });
  }

  @Get('ops')
  @AdminRoles('super_admin', 'ops_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'Ops and support queue health report' })
  getOpsReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('preset') preset?: string
  ) {
    return this.adminReportsService.getOpsReport({ startDate, endDate, preset });
  }
}
