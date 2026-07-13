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

export interface EmailProviderPort {
  sendOtp(input: SendEmailOtpInput): Promise<SendEmailOtpResult>;
}
