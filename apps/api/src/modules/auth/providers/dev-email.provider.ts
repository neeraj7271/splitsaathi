import { Injectable, Logger } from '@nestjs/common';
import { ApiConfigService } from '../../../config/api-config.service';
import {
  EmailProviderPort,
  SendEmailInput,
  SendEmailOtpInput,
  SendEmailOtpResult,
  SendEmailResult
} from '../ports/email-provider.port';

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

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    this.logger.log(
      `Development email to=${input.to} subject=${JSON.stringify(input.subject)} body=${JSON.stringify(input.text)}`
    );
    return { deliveryMode: 'development' };
  }
}
