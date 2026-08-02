import { resolveBrevoSender, parseEmailFrom } from '../../src/modules/auth/providers/email-sender.util';

describe('email-sender.util', () => {
  it('parses display-form email addresses', () => {
    expect(parseEmailFrom('SplitSaathi <noreply@thesplitsaathi.com>')).toEqual({
      name: 'SplitSaathi',
      email: 'noreply@thesplitsaathi.com'
    });
  });

  it('prefers explicit Brevo sender env vars', () => {
    expect(
      resolveBrevoSender({
        BREVO_SENDER_EMAIL: 'hello@thesplitsaathi.com',
        BREVO_SENDER_NAME: 'SplitSaathi',
        EMAIL_FROM: 'Other <other@example.com>'
      })
    ).toEqual({
      email: 'hello@thesplitsaathi.com',
      name: 'SplitSaathi'
    });
  });

  it('falls back to EMAIL_FROM when Brevo sender email is missing', () => {
    expect(
      resolveBrevoSender({
        EMAIL_FROM: 'SplitSaathi <noreply@thesplitsaathi.com>'
      })
    ).toEqual({
      email: 'noreply@thesplitsaathi.com',
      name: 'SplitSaathi'
    });
  });
});
