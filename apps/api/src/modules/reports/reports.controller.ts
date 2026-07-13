import { BadRequestException, Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request';
import { FINANCIAL_AUTHORIZATION, type FinancialAuthorizationPort } from '../ledger/financial-authorization';
import { ReportsService } from './reports.service';

type DateRangeQuery = { from?: string; to?: string };

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    @Inject(FINANCIAL_AUTHORIZATION) private readonly authorization: FinancialAuthorizationPort
  ) {}

  @Get('reports/group-types')
  @ApiOkResponse()
  async groupTypes(@CurrentUser() currentUser: AuthenticatedUser, @Query() query: DateRangeQuery) {
    const range = this.range(query);
    return { ...this.publicRange(range), items: await this.reports.groupTypeBreakdown(currentUser.userId, range) };
  }

  @Get('groups/:groupId/reports/monthly-comparison')
  async monthlyComparison(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Query() query: DateRangeQuery
  ) {
    await this.authorization.assertCan(currentUser.userId, groupId, 'read');
    const range = this.range(query);
    return { ...this.publicRange(range), items: await this.reports.monthlyComparison(groupId, range) };
  }

  @Get('groups/:groupId/reports/member-contributions')
  async memberContributions(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Query() query: DateRangeQuery
  ) {
    await this.authorization.assertCan(currentUser.userId, groupId, 'read');
    const range = this.range(query);
    return { ...this.publicRange(range), items: await this.reports.memberContributions(groupId, range) };
  }

  @Get('groups/:groupId/reports/settlement-methods')
  async settlementMethods(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Query() query: DateRangeQuery
  ) {
    await this.authorization.assertCan(currentUser.userId, groupId, 'read');
    const range = this.range(query);
    return { ...this.publicRange(range), items: await this.reports.settlementMethodBreakdown(groupId, range) };
  }

  @Get('groups/:groupId/reports/net-position')
  async netPosition(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Query() query: DateRangeQuery
  ) {
    await this.authorization.assertCan(currentUser.userId, groupId, 'read');
    const range = this.range(query);
    return { ...this.publicRange(range), items: await this.reports.netPosition(groupId, range) };
  }

  private range(query: DateRangeQuery) {
    try {
      return this.reports.dateRange(query.from, query.to);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid date range.');
    }
  }

  private publicRange(range: ReturnType<ReportsService['dateRange']>) {
    return { from: range.from, to: range.to };
  }
}
