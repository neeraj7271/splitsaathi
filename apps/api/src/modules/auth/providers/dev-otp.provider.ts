import { Injectable, Logger } from '@nestjs/common';
import { ApiConfigService } from '../../../config/api-config.service';
import { OtpProviderPort, OtpStartInput, OtpStartResult, OtpVerifyInput } from '../ports/otp-provider.port';

@Injectable()
export class DevOtpProvider implements OtpProviderPort {
  private readonly logger = new Logger(DevOtpProvider.name);

  constructor(private readonly config: ApiConfigService) {}

  async start(input: OtpStartInput): Promise<OtpStartResult> {
    const devCode = this.config.env.OTP_DEV_CODE;
    this.logger.log(
      `Development OTP for ${input.phoneE164}: challenge=${input.challengeId} code=${devCode}`
    );

    return {
      providerChallengeId: input.challengeId,
      maskedDestination: this.maskPhone(input.phoneE164),
      deliveryMode: 'development',
      devCode: this.config.isProduction ? undefined : devCode
    };
  }

  async verify(input: OtpVerifyInput): Promise<boolean> {
    return input.code === this.config.env.OTP_DEV_CODE;
  }

  private maskPhone(phoneE164: string): string {
    if (phoneE164.length <= 5) {
      return phoneE164;
    }
    return `${phoneE164.slice(0, 3)}***${phoneE164.slice(-2)}`;
  }
}
