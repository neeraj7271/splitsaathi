import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminRolesGuard } from '../auth/guards/admin-roles.guard';
import { AdminRoles } from '../auth/decorators/admin-roles.decorator';
import { CurrentAdmin, AuthenticatedAdmin } from '../auth/decorators/current-admin.decorator';
import { AdminAuditInterceptor } from '../audit-log/interceptors/admin-audit.interceptor';
import { AdminSupportService } from './admin-support.service';
import { ReplyTicketDto, UpdateTicketStatusDto, RetryJobDto } from './dto/support.dto';

@ApiTags('admin-support')
@ApiBearerAuth('admin-auth')
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@Controller('admin/support')
export class AdminSupportController {
  constructor(private readonly adminSupportService: AdminSupportService) {}

  @Get('tickets')
  @AdminRoles('super_admin', 'ops_admin', 'read_only')
  @ApiOkResponse({ description: 'List support tickets' })
  listTickets(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string
  ) {
    return this.adminSupportService.listTickets({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
      priority
    });
  }

  @Get('tickets/:ticketId')
  @AdminRoles('super_admin', 'ops_admin', 'read_only')
  @ApiOkResponse({ description: 'View ticket details and thread messages' })
  getTicketDetail(@Param('ticketId') ticketId: string) {
    return this.adminSupportService.getTicketDetail(ticketId);
  }

  @Post('tickets/:ticketId/reply')
  @AdminRoles('super_admin', 'ops_admin')
  @ApiOkResponse({ description: 'Reply to support ticket' })
  @ApiBody({ type: ReplyTicketDto })
  replyTicket(
    @Param('ticketId') ticketId: string,
    @Body() dto: ReplyTicketDto,
    @CurrentAdmin() admin: AuthenticatedAdmin
  ) {
    return this.adminSupportService.replyTicket(ticketId, admin.adminId, dto.body, 'admin');
  }

  @Patch('tickets/:ticketId/status')
  @AdminRoles('super_admin', 'ops_admin')
  @ApiOkResponse({ description: 'Update ticket status' })
  @ApiBody({ type: UpdateTicketStatusDto })
  updateTicketStatus(
    @Param('ticketId') ticketId: string,
    @Body() dto: UpdateTicketStatusDto
  ) {
    return this.adminSupportService.updateTicketStatus(ticketId, dto.status);
  }

  @Get('jobs/import-export')
  @AdminRoles('super_admin', 'ops_admin', 'finance_admin', 'read_only')
  @ApiOkResponse({ description: 'Monitor Splitwise import & Tally export jobs' })
  listJobs() {
    return this.adminSupportService.listImportExportJobs();
  }

  @Post('jobs/import-export/:jobId/retry')
  @AdminRoles('super_admin', 'ops_admin')
  @ApiOkResponse({ description: 'Retry failed import/export job' })
  @ApiBody({ type: RetryJobDto })
  retryJob(
    @Param('jobId') jobId: string,
    @Body() dto: RetryJobDto
  ) {
    return this.adminSupportService.retryJob(jobId, dto.type);
  }
}
