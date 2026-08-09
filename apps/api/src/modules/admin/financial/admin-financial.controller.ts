import { Body, Controller, Get, Param, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminRolesGuard } from '../auth/guards/admin-roles.guard';
import { AdminRoles } from '../auth/decorators/admin-roles.decorator';
import { AdminAuditInterceptor } from '../audit-log/interceptors/admin-audit.interceptor';
import { AdminFinancialService } from './admin-financial.service';

@ApiTags('admin-financial')
@ApiBearerAuth('admin-auth')
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@Controller('admin/financial')
export class AdminFinancialController {
  constructor(private readonly adminFinancialService: AdminFinancialService) {}

  @Get('expenses')
  @AdminRoles('super_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'Platform-wide expense ledger search' })
  searchExpenses(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('groupId') groupId?: string,
    @Query('minAmount') minAmount?: string,
    @Query('maxAmount') maxAmount?: string,
    @Query('voided') voided?: string
  ) {
    return this.adminFinancialService.searchExpenses({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      groupId,
      minAmount,
      maxAmount,
      voided: voided === 'true' ? true : voided === 'false' ? false : undefined
    });
  }

  @Get('expenses/:expenseId')
  @AdminRoles('super_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'Detailed expense view with splits and adjustments' })
  getExpenseDetail(@Param('expenseId') expenseId: string) {
    return this.adminFinancialService.getExpenseDetail(expenseId);
  }

  @Get('expenses/:expenseId/audit-trail')
  @AdminRoles('super_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'Expense version projection history' })
  getExpenseAuditTrail(@Param('expenseId') expenseId: string) {
    return this.adminFinancialService.getExpenseVersionHistory(expenseId);
  }

  @Get('settlements')
  @AdminRoles('super_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'Platform settlements search' })
  searchSettlements(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('groupId') groupId?: string,
    @Query('state') state?: string
  ) {
    return this.adminFinancialService.searchSettlements({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      groupId,
      state
    });
  }

  @Get('settlements/:settlementId/proof')
  @AdminRoles('super_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'Settlement proof, UTR, and app-open metrics' })
  getSettlementProofDetail(@Param('settlementId') settlementId: string) {
    return this.adminFinancialService.getSettlementProofDetail(settlementId);
  }

  @Post('settlements/:settlementId/force-confirm')
  @AdminRoles('super_admin', 'finance_admin')
  @ApiOkResponse({ description: 'Force confirm settlement override' })
  forceConfirmSettlement(
    @Param('settlementId') settlementId: string,
    @Body('reason') reason?: string
  ) {
    return this.adminFinancialService.forceConfirmSettlement(settlementId, reason);
  }
}
