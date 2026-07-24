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

/** Canonical Indian-friendly E.164 normalizer (always returns a string; may be empty). */
export function normalizePhoneE164India(input: string): string {
  const trimmed = input.trim().replace(/[\s()-]/g, '');
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.startsWith('+')) {
    return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.slice(1)}`;
  }
  return digits ? `+${digits}` : trimmed;
}

export function phoneLookupCandidates(normalized: string): string[] {
  const digits = normalized.replace(/\D/g, '');
  const candidates = new Set<string>([normalized]);
  if (digits) {
    candidates.add(`+${digits}`);
    if (digits.length === 12 && digits.startsWith('91')) {
      candidates.add(digits.slice(2));
      candidates.add(`+91${digits.slice(2)}`);
    }
    if (digits.length === 10) {
      candidates.add(digits);
      candidates.add(`+91${digits}`);
    }
  }
  return [...candidates];
}

export function hashPhoneE164(phoneE164: string, pepper: string): string {
  return createHash('sha256').update(`${pepper}:${phoneE164}`).digest('hex');
}

export function phoneHashPepper(env: { PHONE_HASH_PEPPER?: string; JWT_ACCESS_SECRET: string }): string {
  return env.PHONE_HASH_PEPPER ?? env.JWT_ACCESS_SECRET;
}
