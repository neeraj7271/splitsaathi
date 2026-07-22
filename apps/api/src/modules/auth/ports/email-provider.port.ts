export interface SendEmailOtpInput {
  email: string;
  code: string;
  purpose: 'signup' | 'password_reset';
  expiresAt: Date;
}

export interface SendEmailOtpResult {
  deliveryMode: 'development' | 'resend';
  devCode?: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SendEmailResult {
  deliveryMode: 'development' | 'resend';
}

export interface EmailProviderPort {
  sendOtp(input: SendEmailOtpInput): Promise<SendEmailOtpResult>;
  /** Transactional / product email (not OTP). Dev logs; Resend when configured. */
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
