import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ApiConfigService } from '../../../config/api-config.service';
import { EmailProviderPort, SendEmailOtpInput, SendEmailOtpResult } from '../ports/email-provider.port';

@Injectable()
export class ResendEmailProvider implements EmailProviderPort {
  constructor(private readonly config: ApiConfigService) {}

  async sendOtp(input: SendEmailOtpInput): Promise<SendEmailOtpResult> {
    const { RESEND_API_KEY, EMAIL_FROM } = this.config.env;
    if (!RESEND_API_KEY || !EMAIL_FROM) {
      throw new ServiceUnavailableException('Email delivery is not configured.');
    }

    const subject = input.purpose === 'signup' ? 'Verify your SplitSaathi email' : 'Reset your SplitSaathi password';
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [input.email],
        subject,
        text: `Your SplitSaathi verification code is ${input.code}. It expires at ${input.expiresAt.toISOString()}.`
      })
    });

    if (!response.ok) {
      throw new ServiceUnavailableException('Email delivery failed. Please try again later.');
    }
    return { deliveryMode: 'resend' };
  }
}
