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
  getVersion(@Query('versionCode') versionCode?: string): AppVersionResponse {
    const code = versionCode ? Number.parseInt(versionCode, 10) : undefined;
    return this.versionService.getVersionInfo(code);
  }

  @Public()
  @Post('broadcast-update')
  @ApiOperation({ summary: 'Trigger FCM push notification broadcast for app update' })
  @ApiBody({ type: BroadcastUpdateDto })
  async triggerBroadcast(@Body() dto: BroadcastUpdateDto) {
    return this.notificationsService.broadcastAppUpdate(
      dto.versionName ?? '1.0.0',
      dto.releaseNotes
    );
  }
}
