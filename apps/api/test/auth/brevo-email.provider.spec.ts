import { ServiceUnavailableException } from '@nestjs/common';
import { BrevoEmailProvider } from '../../src/modules/auth/providers/brevo-email.provider';

const sendTransacEmail = jest.fn(async () => ({}));

jest.mock('@getbrevo/brevo', () => ({
  BrevoClient: jest.fn().mockImplementation(() => ({
    transactionalEmails: {
      sendTransacEmail
    }
  }))
}));

describe('BrevoEmailProvider', () => {
  beforeEach(() => {
    sendTransacEmail.mockClear();
  });

  it('sends transactional email through Brevo', async () => {
    const provider = new BrevoEmailProvider({
      env: {
        BREVO_API_KEY: 'test-key',
        BREVO_SENDER_EMAIL: 'noreply@thesplitsaathi.com',
        BREVO_SENDER_NAME: 'SplitSaathi'
      }
    } as any);

    const result = await provider.send({
      to: 'alice@example.com',
      subject: 'Monthly summary',
      text: 'Hello Alice',
      html: '<p>Hello Alice</p>'
    });

    expect(result).toEqual({ deliveryMode: 'brevo' });
    expect(sendTransacEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        sender: { email: 'noreply@thesplitsaathi.com', name: 'SplitSaathi' },
        to: [{ email: 'alice@example.com' }],
        subject: 'Monthly summary',
        textContent: 'Hello Alice',
        htmlContent: '<p>Hello Alice</p>'
      })
    );
  });

  it('rejects when sender is not configured', async () => {
    const provider = new BrevoEmailProvider({
      env: {
        BREVO_API_KEY: 'test-key'
      }
    } as any);

    await expect(
      provider.send({
        to: 'alice@example.com',
        subject: 'Monthly summary',
        text: 'Hello Alice'
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
