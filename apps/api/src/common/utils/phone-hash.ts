import { createHash } from 'crypto';

export function normalizePhoneE164(raw: string, defaultCountryCode = '91'): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) {
    return null;
  }

  if (digits.length === 10 && defaultCountryCode === '91') {
    return `+91${digits}`;
  }

  if (digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}

export function hashPhoneE164(phoneE164: string, pepper: string): string {
  return createHash('sha256').update(`${pepper}:${phoneE164}`).digest('hex');
}

export function phoneHashPepper(env: { PHONE_HASH_PEPPER?: string; JWT_ACCESS_SECRET: string }): string {
  return env.PHONE_HASH_PEPPER ?? env.JWT_ACCESS_SECRET;
}
