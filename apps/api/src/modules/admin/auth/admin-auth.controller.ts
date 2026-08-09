import { Body, Controller, Get, HttpCode, HttpStatus, Req, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { AdminJwtAuthGuard } from './guards/admin-jwt-auth.guard';
import { CurrentAdmin, AuthenticatedAdmin } from './decorators/current-admin.decorator';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminAuthResponseDto, AdminUserDto } from './dto/admin-auth-response.dto';
import { AdminRefreshTokenDto } from './dto/admin-refresh.dto';

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AdminAuthResponseDto })
  login(@Body() dto: AdminLoginDto, @Req() req: Request): Promise<AdminAuthResponseDto> {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.adminAuthService.login(dto, ip, userAgent);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AdminAuthResponseDto })
  refresh(@Body() dto: AdminRefreshTokenDto, @Req() req: Request): Promise<AdminAuthResponseDto> {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.adminAuthService.refresh(dto, ip, userAgent);
  }

  @Post('logout')
  @UseGuards(AdminJwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async logout(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body() dto?: AdminRefreshTokenDto
  ): Promise<void> {
    await this.adminAuthService.logout(admin.sessionId, dto?.refreshToken);
  }

  @Get('me')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth('admin-auth')
  @ApiOkResponse({ type: AdminUserDto })
  getProfile(@CurrentAdmin() admin: AuthenticatedAdmin): Promise<AdminUserDto> {
    return this.adminAuthService.getAdminProfile(admin.adminId);
  }
}
