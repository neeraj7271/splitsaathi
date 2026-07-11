import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiConfigModule } from '../../config/api-config.module';
import { ApiConfigService } from '../../config/api-config.service';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { OTP_PROVIDER } from './auth.constants';
import { AuthService } from './auth.service';
import { AuthIdentityEntity } from './entities/auth-identity.entity';
import { OtpChallengeEntity } from './entities/otp-challenge.entity';
import { RefreshSessionEntity } from './entities/refresh-session.entity';
import { DevOtpProvider } from './providers/dev-otp.provider';
import { TwilioVerifyOtpProvider } from './providers/twilio-verify-otp.provider';

@Module({
  imports: [
    ApiConfigModule,
    JwtModule.register({}),
    UsersModule,
    TypeOrmModule.forFeature([AuthIdentityEntity, OtpChallengeEntity, RefreshSessionEntity])
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    DevOtpProvider,
    TwilioVerifyOtpProvider,
    {
      provide: OTP_PROVIDER,
      inject: [ApiConfigService, DevOtpProvider, TwilioVerifyOtpProvider],
      useFactory: (config: ApiConfigService, dev: DevOtpProvider, twilio: TwilioVerifyOtpProvider) => {
        if (config.env.NODE_ENV === 'production' && config.env.OTP_PROVIDER_DRIVER === 'dev') {
          throw new Error('OTP_PROVIDER_DRIVER=dev is not allowed in production.');
        }
        return config.env.OTP_PROVIDER_DRIVER === 'twilio_verify' ? twilio : dev;
      }
    }
  ],
  exports: [AuthService, TypeOrmModule]
})
export class AuthModule {}
