import { normalizePhoneE164 } from "./phoneHash";

export type PhoneValidationResult = { valid: true; phoneE164: string } | { valid: false; message: string };

const INDIAN_MOBILE_FIRST_DIGITS = new Set(["6", "7", "8", "9"]);

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function nationalMobileDigits(phoneE164: string): string | null {
  const digits = digitsOnly(phoneE164);
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length === 10) {
    return digits;
  }
  return null;
}

function isRepeatingDigit(digits: string) {
  return /^(\d)\1+$/.test(digits);
}

function hasSequentialRun(digits: string, minLength = 6) {
  if (digits.length < minLength) {
    return false;
  }

  for (let index = 0; index <= digits.length - minLength; index += 1) {
    let ascending = true;
    let descending = true;
    for (let offset = 1; offset < minLength; offset += 1) {
      const current = Number.parseInt(digits[index + offset - 1] ?? "0", 10);
      const next = Number.parseInt(digits[index + offset] ?? "0", 10);
      if (next !== current + 1) {
        ascending = false;
      }
      if (next !== current - 1) {
        descending = false;
      }
    }
    if (ascending || descending) {
      return true;
    }
  }

  return false;
}

function hasRepeatingPattern(digits: string) {
  if (digits.length >= 4 && digits.length % 2 === 0) {
    const half = digits.length / 2;
    if (digits.slice(0, half) === digits.slice(half)) {
      return true;
    }
  }
  if (digits.length >= 6 && digits.length % 3 === 0) {
    const third = digits.length / 3;
    const chunk = digits.slice(0, third);
    if (chunk.repeat(3) === digits) {
      return true;
    }
  }
  return false;
}

export function validatePhoneNumber(raw: string, defaultCountryCode = "91"): PhoneValidationResult {
  const phoneE164 = normalizePhoneE164(raw, defaultCountryCode);
  if (!phoneE164) {
    return { valid: false, message: "Enter a valid phone number with country code, e.g. +9198XXXXXXXX." };
  }

  const mobileDigits = nationalMobileDigits(phoneE164);
  if (defaultCountryCode === "91") {
    if (!mobileDigits || mobileDigits.length !== 10) {
      return { valid: false, message: "Enter a valid 10-digit Indian mobile number." };
    }
    if (!INDIAN_MOBILE_FIRST_DIGITS.has(mobileDigits[0] ?? "")) {
      return { valid: false, message: "Indian mobile numbers must start with 6, 7, 8, or 9." };
    }
    if (isRepeatingDigit(mobileDigits)) {
      return { valid: false, message: "That phone number does not look valid." };
    }
    if (hasSequentialRun(mobileDigits, 6)) {
      return { valid: false, message: "That phone number does not look valid." };
    }
    if (hasRepeatingPattern(mobileDigits)) {
      return { valid: false, message: "That phone number does not look valid." };
    }
  }

  return { valid: true, phoneE164 };
}
