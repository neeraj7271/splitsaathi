import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiConfigModule } from '../../config/api-config.module';
import { ApiConfigService } from '../../config/api-config.service';
import { ConsentsModule } from '../consents/consents.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { EMAIL_PROVIDER, OTP_PROVIDER } from './auth.constants';
import { AuthService } from './auth.service';
import { AuthIdentityEntity } from './entities/auth-identity.entity';
import { EmailCredentialEntity } from './entities/email-credential.entity';
import { EmailOtpChallengeEntity } from './entities/email-otp-challenge.entity';
import { OtpChallengeEntity } from './entities/otp-challenge.entity';
import { RefreshSessionEntity } from './entities/refresh-session.entity';
import { DevOtpProvider } from './providers/dev-otp.provider';
import { DevEmailProvider } from './providers/dev-email.provider';
import { ResendEmailProvider } from './providers/resend-email.provider';
import { TwilioVerifyOtpProvider } from './providers/twilio-verify-otp.provider';

@Module({
  imports: [
    ApiConfigModule,
    JwtModule.register({}),
    UsersModule,
    ConsentsModule,
    TypeOrmModule.forFeature([
      AuthIdentityEntity,
      OtpChallengeEntity,
      RefreshSessionEntity,
      EmailCredentialEntity,
      EmailOtpChallengeEntity
    ])
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    DevOtpProvider,
    TwilioVerifyOtpProvider,
    DevEmailProvider,
    ResendEmailProvider,
    {
      provide: OTP_PROVIDER,
      inject: [ApiConfigService, DevOtpProvider, TwilioVerifyOtpProvider],
      useFactory: (config: ApiConfigService, dev: DevOtpProvider, twilio: TwilioVerifyOtpProvider) => {
        if (
          config.env.NODE_ENV === 'production' &&
          config.env.OTP_PROVIDER_DRIVER === 'dev' &&
          !config.env.ALLOW_INSECURE_DEV_PROVIDERS
        ) {
          throw new Error('OTP_PROVIDER_DRIVER=dev is not allowed in production.');
        }
        return config.env.OTP_PROVIDER_DRIVER === 'twilio_verify' ? twilio : dev;
      }
    },
    {
      provide: EMAIL_PROVIDER,
      inject: [ApiConfigService, DevEmailProvider, ResendEmailProvider],
      useFactory: (config: ApiConfigService, dev: DevEmailProvider, resend: ResendEmailProvider) => {
        if (
          config.env.NODE_ENV === 'production' &&
          config.env.EMAIL_PROVIDER_DRIVER === 'dev' &&
          !config.env.ALLOW_INSECURE_DEV_PROVIDERS
        ) {
          throw new Error('EMAIL_PROVIDER_DRIVER=dev is not allowed in production.');
        }
        return config.env.EMAIL_PROVIDER_DRIVER === 'resend' ? resend : dev;
      }
    }
  ],
  exports: [AuthService, TypeOrmModule, EMAIL_PROVIDER]
})
export class AuthModule {}
