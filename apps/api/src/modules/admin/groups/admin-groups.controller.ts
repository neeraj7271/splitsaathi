import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminRolesGuard } from '../auth/guards/admin-roles.guard';
import { AdminRoles } from '../auth/decorators/admin-roles.decorator';
import { AdminAuditInterceptor } from '../audit-log/interceptors/admin-audit.interceptor';
import { AdminGroupsService } from './admin-groups.service';

@ApiTags('admin-groups')
@ApiBearerAuth('admin-auth')
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@Controller('admin/groups')
export class AdminGroupsController {
  constructor(private readonly adminGroupsService: AdminGroupsService) {}

  @Get()
  @AdminRoles('super_admin', 'ops_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'Paginated groups list' })
  listGroups(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('mode') mode?: string,
    @Query('state') state?: string
  ) {
    return this.adminGroupsService.listGroups({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      mode,
      state
    });
  }

  @Get(':groupId')
  @AdminRoles('super_admin', 'ops_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'Detailed group view' })
  getGroupDetail(@Param('groupId') groupId: string) {
    return this.adminGroupsService.getGroupDetail(groupId);
  }

  @Post(':groupId/flag')
  @AdminRoles('super_admin', 'ops_admin')
  @ApiOkResponse({ description: 'Flag group for fraud/abuse investigation' })
  flagGroup(@Param('groupId') groupId: string, @Body('reason') reason?: string) {
    return this.adminGroupsService.flagGroup(groupId, reason);
  }

  @Post(':groupId/unflag')
  @AdminRoles('super_admin', 'ops_admin')
  @ApiOkResponse({ description: 'Clear fraud/abuse flag on group' })
  unflagGroup(@Param('groupId') groupId: string) {
    return this.adminGroupsService.unflagGroup(groupId);
  }

  @Patch(':groupId/unarchive')
  @AdminRoles('super_admin', 'ops_admin')
  @ApiOkResponse({ description: 'Unarchive group and restore to active state' })
  unarchiveGroup(@Param('groupId') groupId: string, @Body('reason') reason?: string) {
    return this.adminGroupsService.unarchiveGroup(groupId, reason);
  }
}
