import { Inject, Injectable, Optional } from '@nestjs/common';
import { ApiConfigService } from '../../../config/api-config.service';
import type { OtpProviderPort, OtpStartInput, OtpStartResult, OtpVerifyInput } from '../ports/otp-provider.port';

type FetchLike = (input: string, init: RequestInit) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<Record<string, unknown>>;
}>;

export const TWILIO_VERIFY_FETCH = Symbol('TWILIO_VERIFY_FETCH');

@Injectable()
export class TwilioVerifyOtpProvider implements OtpProviderPort {
  private readonly fetchFn: FetchLike;

  constructor(
    private readonly config: ApiConfigService,
    @Optional() @Inject(TWILIO_VERIFY_FETCH) fetchFn?: FetchLike
  ) {
    this.fetchFn = fetchFn ?? (fetch as FetchLike);
  }

  async start(input: OtpStartInput): Promise<OtpStartResult> {
    const serviceSid = this.requireEnv('TWILIO_VERIFY_SERVICE_SID');
    const response = await this.fetchFn(
      `https://verify.twilio.com/v2/Services/${encodeURIComponent(serviceSid)}/Verifications`,
      {
        method: 'POST',
        headers: this.headers(),
        body: new URLSearchParams({
          To: input.phoneE164,
          Channel: 'sms',
          CustomFriendlyName: 'SplitSaathi'
        }).toString()
      }
    );
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(`Twilio Verify start failed (${response.status}): ${String(payload.message ?? 'unknown error')}`);
    }

    return {
      providerChallengeId: String(payload.sid ?? input.challengeId),
      maskedDestination: maskPhone(input.phoneE164),
      deliveryMode: 'sms'
    };
  }

  async verify(input: OtpVerifyInput): Promise<boolean> {
    const serviceSid = this.requireEnv('TWILIO_VERIFY_SERVICE_SID');
    const response = await this.fetchFn(
      `https://verify.twilio.com/v2/Services/${encodeURIComponent(serviceSid)}/VerificationCheck`,
      {
        method: 'POST',
        headers: this.headers(),
        body: new URLSearchParams({
          To: input.phoneE164,
          Code: input.code
        }).toString()
      }
    );
    if (!response.ok) {
      return false;
    }
    const payload = await response.json();
    return payload.status === 'approved' || payload.valid === true;
  }

  private headers(): Record<string, string> {
    const accountSid = this.requireEnv('TWILIO_ACCOUNT_SID');
    const authToken = this.requireEnv('TWILIO_AUTH_TOKEN');
    const token = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    return {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    };
  }

  private requireEnv(key: 'TWILIO_ACCOUNT_SID' | 'TWILIO_AUTH_TOKEN' | 'TWILIO_VERIFY_SERVICE_SID'): string {
    const value = this.config.env[key];
    if (!value) {
      throw new Error(`${key} is required when OTP_PROVIDER_DRIVER=twilio_verify.`);
    }
    return value;
  }
}

function maskPhone(phoneE164: string): string {
  if (phoneE164.length <= 5) {
    return phoneE164;
  }
  return `${phoneE164.slice(0, 3)}***${phoneE164.slice(-2)}`;
}
