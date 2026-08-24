import { Body, Controller, Get, Param, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminRolesGuard } from '../auth/guards/admin-roles.guard';
import { AdminRoles } from '../auth/decorators/admin-roles.decorator';
import { AdminAuditInterceptor } from '../audit-log/interceptors/admin-audit.interceptor';
import { AdminManagementService } from './admin-management.service';
import { CreateAdminUserDto, UpdateAdminUserDto } from './dto/admin-management.dto';

@ApiTags('admin-management')
@ApiBearerAuth('admin-auth')
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@Controller('admin/management')
export class AdminManagementController {
  constructor(private readonly adminManagementService: AdminManagementService) {}

  @Get('admins')
  @AdminRoles('super_admin')
  @ApiOkResponse({ description: 'List registered admin users' })
  listAdmins() {
    return this.adminManagementService.listAdmins();
  }

  @Post('admins')
  @AdminRoles('super_admin')
  @ApiOkResponse({ description: 'Create a new admin user' })
  @ApiBody({ type: CreateAdminUserDto })
  createAdmin(@Body() dto: CreateAdminUserDto) {
    return this.adminManagementService.createAdmin(dto);
  }

  @Patch('admins/:id')
  @AdminRoles('super_admin')
  @ApiOkResponse({ description: 'Update role or status of an admin user' })
  @ApiBody({ type: UpdateAdminUserDto })
  updateAdmin(
    @Param('id') adminId: string,
    @Body() dto: UpdateAdminUserDto
  ) {
    return this.adminManagementService.updateAdmin(adminId, dto.role, dto.status);
  }

  @Get('sessions')
  @AdminRoles('super_admin')
  @ApiOkResponse({ description: 'List active admin login sessions' })
  listSessions() {
    return this.adminManagementService.listActiveSessions();
  }

  @Post('sessions/:id/revoke')
  @AdminRoles('super_admin')
  @ApiOkResponse({ description: 'Revoke an admin login session' })
  revokeSession(@Param('id') sessionId: string) {
    return this.adminManagementService.revokeSession(sessionId);
  }
}
