import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AdminRoles } from '../admin/auth/decorators/admin-roles.decorator';
import { AdminJwtAuthGuard } from '../admin/auth/guards/admin-jwt-auth.guard';
import { AdminRolesGuard } from '../admin/auth/guards/admin-roles.guard';
import { NotificationsService } from '../notifications/notifications.service';
import { AppVersionResponse, AppVersionService } from './app-version.service';
import { BroadcastUpdateDto } from './dto/broadcast-update.dto';

@ApiTags('App Version')
@Controller('app')
export class AppVersionController {
  constructor(
    private readonly versionService: AppVersionService,
    private readonly notificationsService: NotificationsService
  ) {}

  @Public()
  @Get('version')
  @ApiOperation({ summary: 'Get current app version metadata and update check' })
  @ApiQuery({ name: 'versionCode', required: false, type: Number, description: 'Client Android versionCode' })
  async getVersion(@Query('versionCode') versionCode?: string): Promise<AppVersionResponse> {
    const code = versionCode ? Number.parseInt(versionCode, 10) : undefined;
    return this.versionService.getVersionInfo(code);
  }

  @Post('broadcast-update')
  @UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
  @AdminRoles('super_admin', 'ops_admin')
  @ApiBearerAuth('admin-auth')
  @ApiOperation({ summary: 'Trigger FCM push notification broadcast and update version code' })
  @ApiBody({ type: BroadcastUpdateDto })
  async triggerBroadcast(@Body() dto: BroadcastUpdateDto) {
    const fileConfig = this.versionService.getVersionConfig();
    const savedConfig = await this.versionService.updateVersionConfig(dto);
    const versionName = dto.versionName ?? savedConfig.latestVersion ?? fileConfig.versionName;
    const releaseNotes = dto.releaseNotes ?? savedConfig.changelog ?? fileConfig.releaseNotes;

    const notificationResult = await this.notificationsService.broadcastAppUpdate(
      versionName,
      releaseNotes,
      fileConfig.directApkUrl
    );

    return {
      success: true,
      message: `Version updated to ${versionName} and notification broadcasted`,
      notificationResult
    };
  }
}
