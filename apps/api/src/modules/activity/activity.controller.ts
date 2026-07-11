import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request';
import { ActivityProjector } from '../ledger';
import { FINANCIAL_AUTHORIZATION, type FinancialAuthorizationPort } from '../ledger/financial-authorization';

@ApiTags('activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ActivityController {
  constructor(
    private readonly activity: ActivityProjector,
    @Inject(FINANCIAL_AUTHORIZATION) private readonly authorization: FinancialAuthorizationPort
  ) {}

  @Get('groups/:groupId/activity')
  async listGroupActivity(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Query('q') query?: string
  ) {
    await this.authorization.assertCan(currentUser.userId, groupId, 'read');
    return query ? this.activity.search(groupId, query) : this.activity.listGroupActivity(groupId);
  }
}
