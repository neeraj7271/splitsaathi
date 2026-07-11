export interface OtpStartInput {
  challengeId: string;
  phoneE164: string;
  expiresAt: Date;
  purpose: 'login';
}

export interface OtpStartResult {
  providerChallengeId: string;
  maskedDestination: string;
  deliveryMode: 'development' | 'sms' | 'whatsapp';
  devCode?: string;
}

export interface OtpVerifyInput {
  providerChallengeId: string;
  phoneE164: string;
  code: string;
}

export interface OtpProviderPort {
  start(input: OtpStartInput): Promise<OtpStartResult>;
  verify(input: OtpVerifyInput): Promise<boolean>;
}
