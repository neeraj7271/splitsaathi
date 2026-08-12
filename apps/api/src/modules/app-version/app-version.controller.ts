import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AppVersionResponse, AppVersionService } from './app-version.service';

@ApiTags('App Version')
@Controller('app')
export class AppVersionController {
  constructor(private readonly versionService: AppVersionService) {}

  @Public()
  @Get('version')
  @ApiOperation({ summary: 'Get current app version metadata and update check' })
  @ApiQuery({ name: 'versionCode', required: false, type: Number, description: 'Client Android versionCode' })
  getVersion(@Query('versionCode') versionCode?: string): AppVersionResponse {
    const code = versionCode ? Number.parseInt(versionCode, 10) : undefined;
    return this.versionService.getVersionInfo(code);
  }
}
