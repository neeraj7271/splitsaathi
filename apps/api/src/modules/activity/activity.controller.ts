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
    @Query('q') query?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursorRaw?: string,
    @Query('feed') feedRaw?: string
  ) {
    await this.authorization.assertCan(currentUser.userId, groupId, 'read');
    const limit = limitRaw !== undefined ? Number(limitRaw) : undefined;
    const cursor = cursorRaw !== undefined ? Number(cursorRaw) : undefined;
    const feed: 'ledger' | 'settlement' | 'all' =
      feedRaw === 'all' || feedRaw === 'settlement' || feedRaw === 'ledger' ? feedRaw : 'ledger';
    const pageQuery = {
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor: Number.isFinite(cursor) ? cursor : undefined,
      feed
    };
    return query
      ? this.activity.search(groupId, query, pageQuery)
      : this.activity.listGroupActivity(groupId, pageQuery);
  }
}
