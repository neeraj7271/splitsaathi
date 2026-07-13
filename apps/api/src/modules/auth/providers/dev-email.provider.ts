import { Injectable, Logger } from '@nestjs/common';
import { ApiConfigService } from '../../../config/api-config.service';
import { EmailProviderPort, SendEmailOtpInput, SendEmailOtpResult } from '../ports/email-provider.port';

@Injectable()
export class DevEmailProvider implements EmailProviderPort {
  private readonly logger = new Logger(DevEmailProvider.name);

  constructor(private readonly config: ApiConfigService) {}

  async sendOtp(input: SendEmailOtpInput): Promise<SendEmailOtpResult> {
    this.logger.log(`Development email OTP for ${input.email}: purpose=${input.purpose} code=${input.code}`);
    return {
      deliveryMode: 'development',
      devCode: this.config.isProduction ? undefined : input.code
    };
  }
}
