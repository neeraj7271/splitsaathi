export type EmailSender = {
  email: string;
  name: string;
};

/** Parses `SplitSaathi <noreply@domain.com>` or a bare email address. */
export function parseEmailFrom(value?: string): Pick<EmailSender, 'email'> & Partial<Pick<EmailSender, 'name'>> {
  const trimmed = value?.trim();
  if (!trimmed) {
    return { email: '' };
  }

  const displayMatch = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  if (displayMatch) {
    return {
      name: displayMatch[1].trim(),
      email: displayMatch[2].trim()
    };
  }

  return { email: trimmed };
}

export function resolveBrevoSender(env: {
  BREVO_SENDER_EMAIL?: string;
  BREVO_SENDER_NAME?: string;
  EMAIL_FROM?: string;
}): EmailSender {
  const fromEmail = env.BREVO_SENDER_EMAIL?.trim();
  if (fromEmail) {
    return {
      email: fromEmail,
      name: env.BREVO_SENDER_NAME?.trim() || 'SplitSaathi'
    };
  }

  const parsed = parseEmailFrom(env.EMAIL_FROM);
  if (!parsed.email) {
    return { email: '', name: 'SplitSaathi' };
  }

  return {
    email: parsed.email,
    name: parsed.name?.trim() || env.BREVO_SENDER_NAME?.trim() || 'SplitSaathi'
  };
}
