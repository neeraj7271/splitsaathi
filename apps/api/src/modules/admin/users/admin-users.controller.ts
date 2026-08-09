import { Body, Controller, Get, Param, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminRolesGuard } from '../auth/guards/admin-roles.guard';
import { AdminRoles } from '../auth/decorators/admin-roles.decorator';
import { CurrentAdmin, AuthenticatedAdmin } from '../auth/decorators/current-admin.decorator';
import { AdminAuditInterceptor } from '../audit-log/interceptors/admin-audit.interceptor';
import { AdminUsersService } from './admin-users.service';

@ApiTags('admin-users')
@ApiBearerAuth('admin-auth')
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @AdminRoles('super_admin', 'ops_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'Paginated user list' })
  listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string
  ) {
    return this.adminUsersService.listUsers({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      status
    });
  }

  @Get(':userId')
  @AdminRoles('super_admin', 'ops_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'Detailed user profile and statistics' })
  getUserDetail(@Param('userId') userId: string) {
    return this.adminUsersService.getUserDetail(userId);
  }

  @Post(':userId/suspend')
  @AdminRoles('super_admin', 'ops_admin')
  @ApiOkResponse({ description: 'Suspend user' })
  suspendUser(@Param('userId') userId: string, @Body('reason') reason?: string) {
    return this.adminUsersService.suspendUser(userId, reason);
  }

  @Post(':userId/unsuspend')
  @AdminRoles('super_admin', 'ops_admin')
  @ApiOkResponse({ description: 'Unsuspend user' })
  unsuspendUser(@Param('userId') userId: string) {
    return this.adminUsersService.unsuspendUser(userId);
  }

  @Post(':userId/force-logout')
  @AdminRoles('super_admin', 'ops_admin')
  @ApiOkResponse({ description: 'Force logout across all active sessions' })
  forceLogoutUser(@Param('userId') userId: string) {
    return this.adminUsersService.forceLogoutUser(userId);
  }

  @Post(':userId/impersonate')
  @AdminRoles('super_admin', 'ops_admin')
  @ApiOkResponse({ description: 'Generate read-only support impersonation token' })
  impersonateUser(
    @Param('userId') userId: string,
    @CurrentAdmin() admin: AuthenticatedAdmin
  ) {
    return this.adminUsersService.generateImpersonationToken(userId, admin.adminId);
  }

  @Post(':userId/gdpr-delete')
  @AdminRoles('super_admin')
  @ApiOkResponse({ description: 'Perform DPDP soft delete on user profile' })
  gdprDeleteUser(@Param('userId') userId: string) {
    return this.adminUsersService.gdprSoftDeleteUser(userId);
  }
}
