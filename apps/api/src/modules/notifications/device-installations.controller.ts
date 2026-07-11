import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request';
import { DeviceInstallationsService } from './device-installations.service';

@ApiTags('device-installations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('device-installations')
export class DeviceInstallationsController {
  constructor(private readonly devices: DeviceInstallationsService) {}

  @Post()
  register(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: { platform: 'ios' | 'android'; appVersion?: string; pushToken?: string }
  ) {
    return this.devices.register({
      userId: currentUser.userId,
      platform: body.platform,
      appVersion: body.appVersion ?? 'development',
      pushToken: body.pushToken
    });
  }
}
