import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import {
  EmailPasswordLoginDto,
  ResetPasswordDto,
  StartEmailOtpResponseDto,
  StartEmailSignupDto,
  StartPasswordResetDto,
  VerifyEmailSignupDto
} from './dto/email-auth.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { StartOtpDto, StartOtpResponseDto } from './dto/start-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('otp/start')
  @ApiCreatedResponse({ type: StartOtpResponseDto })
  startOtp(@Body() dto: StartOtpDto): Promise<StartOtpResponseDto> {
    return this.authService.startOtp(dto);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  verifyOtp(@Body() dto: VerifyOtpDto): Promise<AuthResponseDto> {
    return this.authService.verifyOtp(dto);
  }

  @Public()
  @Post('email/signup/start')
  @ApiCreatedResponse({ type: StartEmailOtpResponseDto })
  startEmailSignup(@Body() dto: StartEmailSignupDto): Promise<StartEmailOtpResponseDto> {
    return this.authService.startEmailSignup(dto);
  }

  @Public()
  @Post('email/signup/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  verifyEmailSignup(@Body() dto: VerifyEmailSignupDto): Promise<AuthResponseDto> {
    return this.authService.verifyEmailSignup(dto);
  }

  @Public()
  @Post('email/login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  loginWithEmailPassword(@Body() dto: EmailPasswordLoginDto): Promise<AuthResponseDto> {
    return this.authService.loginWithEmailPassword(dto);
  }

  @Public()
  @Post('password/forgot')
  @ApiCreatedResponse({ type: StartEmailOtpResponseDto })
  startPasswordReset(@Body() dto: StartPasswordResetDto): Promise<StartEmailOtpResponseDto> {
    return this.authService.startPasswordReset(dto);
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(dto);
  }

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  loginWithGoogle(@Body() dto: GoogleAuthDto): Promise<AuthResponseDto> {
    return this.authService.loginWithGoogle(dto.idToken);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async logout(@CurrentUser() currentUser: AuthenticatedUser, @Body() dto: LogoutDto): Promise<void> {
    await this.authService.logout({
      sessionId: currentUser.sessionId,
      refreshToken: dto.refreshToken
    });
  }
}
