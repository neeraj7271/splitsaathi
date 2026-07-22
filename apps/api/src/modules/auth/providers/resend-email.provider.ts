import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ApiConfigService } from '../../../config/api-config.service';
import {
  EmailProviderPort,
  SendEmailInput,
  SendEmailOtpInput,
  SendEmailOtpResult,
  SendEmailResult
} from '../ports/email-provider.port';

@Injectable()
export class ResendEmailProvider implements EmailProviderPort {
  constructor(private readonly config: ApiConfigService) {}

  async sendOtp(input: SendEmailOtpInput): Promise<SendEmailOtpResult> {
    const subject = input.purpose === 'signup' ? 'Verify your SplitSaathi email' : 'Reset your SplitSaathi password';
    await this.deliver({
      to: input.email,
      subject,
      text: `Your SplitSaathi verification code is ${input.code}. It expires at ${input.expiresAt.toISOString()}.`
    });
    return { deliveryMode: 'resend' };
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    await this.deliver(input);
    return { deliveryMode: 'resend' };
  }

  private async deliver(input: SendEmailInput): Promise<void> {
    const { RESEND_API_KEY, EMAIL_FROM } = this.config.env;
    if (!RESEND_API_KEY || !EMAIL_FROM) {
      throw new ServiceUnavailableException('Email delivery is not configured.');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {})
      })
    });

    if (!response.ok) {
      throw new ServiceUnavailableException('Email delivery failed. Please try again later.');
    }
  }
}
