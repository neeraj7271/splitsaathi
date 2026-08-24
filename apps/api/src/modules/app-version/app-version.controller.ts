import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
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

  @Public()
  @Post('broadcast-update')
  @ApiOperation({ summary: 'Trigger FCM push notification broadcast and update version code' })
  @ApiBody({ type: BroadcastUpdateDto })
  async triggerBroadcast(@Body() dto: BroadcastUpdateDto) {
    // 1. Automatically update backend version database config
    await this.versionService.updateVersionConfig(dto);

    // 2. Broadcast FCM notification to all active devices
    const notificationResult = await this.notificationsService.broadcastAppUpdate(
      dto.versionName ?? '1.0.1',
      dto.releaseNotes
    );

    return {
      success: true,
      message: `Version updated to ${dto.versionName ?? '1.0.1'} and notification broadcasted`,
      notificationResult
    };
  }
}
