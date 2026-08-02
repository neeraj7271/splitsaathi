import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { BrevoClient } from '@getbrevo/brevo';
import { ApiConfigService } from '../../../config/api-config.service';
import {
  EmailProviderPort,
  SendEmailInput,
  SendEmailOtpInput,
  SendEmailOtpResult,
  SendEmailResult
} from '../ports/email-provider.port';
import { resolveBrevoSender } from './email-sender.util';

@Injectable()
export class BrevoEmailProvider implements EmailProviderPort {
  private readonly logger = new Logger(BrevoEmailProvider.name);
  private client: BrevoClient | null = null;

  constructor(private readonly config: ApiConfigService) {}

  async sendOtp(input: SendEmailOtpInput): Promise<SendEmailOtpResult> {
    const subject = input.purpose === 'signup' ? 'Verify your SplitSaathi email' : 'Reset your SplitSaathi password';
    const text = `Your SplitSaathi verification code is ${input.code}. It expires at ${input.expiresAt.toISOString()}.`;
    await this.deliver({
      to: input.email,
      subject,
      text,
      html: `<p>Your SplitSaathi verification code is <strong>${input.code}</strong>.</p><p>It expires at ${input.expiresAt.toISOString()}.</p>`
    });
    return { deliveryMode: 'brevo' };
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    await this.deliver(input);
    return { deliveryMode: 'brevo' };
  }

  private getClient(): BrevoClient {
    const apiKey = this.config.env.BREVO_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('Brevo email delivery is not configured.');
    }

    if (!this.client) {
      this.client = new BrevoClient({ apiKey });
    }

    return this.client;
  }

  private async deliver(input: SendEmailInput): Promise<void> {
    const sender = resolveBrevoSender(this.config.env);
    if (!sender.email) {
      throw new ServiceUnavailableException(
        'Brevo sender is not configured. Set BREVO_SENDER_EMAIL or EMAIL_FROM to a verified domain address.'
      );
    }

    try {
      await this.getClient().transactionalEmails.sendTransacEmail({
        sender,
        to: [{ email: input.to }],
        subject: input.subject,
        textContent: input.text,
        htmlContent: input.html ?? `<p>${escapeHtml(input.text).replace(/\n/g, '<br />')}</p>`
      });
      this.logger.log(`Brevo email sent to ${input.to}`);
    } catch (error) {
      this.logger.error('Brevo email delivery failed', error instanceof Error ? error.message : error);
      throw new ServiceUnavailableException('Email delivery failed. Please try again later.');
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
