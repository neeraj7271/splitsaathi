import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request';
import { FINANCIAL_AUTHORIZATION, type FinancialAuthorizationPort } from '../ledger/financial-authorization';
import { BalanceQueryService } from './balance-query.service';

@ApiTags('balances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class BalancesController {
  constructor(
    private readonly queries: BalanceQueryService,
    @Inject(FINANCIAL_AUTHORIZATION) private readonly authorization: FinancialAuthorizationPort
  ) {}

  @Get('groups/:groupId/balances')
  async getGroupBalances(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('groupId') groupId: string
  ): Promise<ReturnType<BalanceQueryService['getGroupBalances']>> {
    await this.authorization.assertCan(currentUser.userId, groupId, 'read');
    return this.queries.getGroupBalances(groupId);
  }
}
