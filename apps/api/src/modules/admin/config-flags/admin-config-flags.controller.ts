import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminRolesGuard } from '../auth/guards/admin-roles.guard';
import { AdminRoles } from '../auth/decorators/admin-roles.decorator';
import { CurrentAdmin, AuthenticatedAdmin } from '../auth/decorators/current-admin.decorator';
import { AdminAuditInterceptor } from '../audit-log/interceptors/admin-audit.interceptor';
import { AdminConfigFlagsService } from './admin-config-flags.service';
import { UpsertFeatureFlagDto, UpdateAppConfigDto } from './dto/config-flags.dto';

@ApiTags('admin-config-flags')
@ApiBearerAuth('admin-auth')
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@Controller('admin/config')
export class AdminConfigFlagsController {
  constructor(private readonly adminConfigFlagsService: AdminConfigFlagsService) {}

  @Get('feature-flags')
  @AdminRoles('super_admin', 'ops_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'List all feature flags' })
  listFeatureFlags() {
    return this.adminConfigFlagsService.listFeatureFlags();
  }

  @Post('feature-flags')
  @AdminRoles('super_admin')
  @ApiOkResponse({ description: 'Create or update feature flag' })
  @ApiBody({ type: UpsertFeatureFlagDto })
  upsertFeatureFlag(
    @Body() dto: UpsertFeatureFlagDto,
    @CurrentAdmin() admin: AuthenticatedAdmin
  ) {
    return this.adminConfigFlagsService.upsertFeatureFlag(dto, admin.adminId);
  }

  @Delete('feature-flags/:key')
  @AdminRoles('super_admin')
  @ApiOkResponse({ description: 'Delete feature flag' })
  deleteFeatureFlag(@Param('key') key: string) {
    return this.adminConfigFlagsService.deleteFeatureFlag(key);
  }

  @Get('app-version')
  @AdminRoles('super_admin', 'ops_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'View minimum supported version and update config' })
  getAppConfigs() {
    return this.adminConfigFlagsService.getAppConfigs();
  }

  @Put('app-version')
  @AdminRoles('super_admin')
  @ApiOkResponse({ description: 'Update minimum supported version and force update config' })
  @ApiBody({ type: UpdateAppConfigDto })
  updateAppConfig(
    @Body() dto: UpdateAppConfigDto,
    @CurrentAdmin() admin: AuthenticatedAdmin
  ) {
    return this.adminConfigFlagsService.updateAppConfig(dto, admin.adminId);
  }
}
