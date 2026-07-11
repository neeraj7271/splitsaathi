import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DevOtpProvider } from '../../src/modules/auth/providers/dev-otp.provider';
import { TwilioVerifyOtpProvider } from '../../src/modules/auth/providers/twilio-verify-otp.provider';
import { SetuAccountAggregatorProvider } from '../../src/modules/imports-exports/setu-account-aggregator.provider';
import { DevNotificationProvider } from '../../src/modules/notifications/providers/dev-notification.provider';
import { ExpoPushProvider } from '../../src/modules/notifications/providers/expo-push.provider';
import { LocalObjectStorageProvider } from '../../src/modules/receipts-capture/local-object-storage.provider';
import { NoopOcrProvider } from '../../src/modules/receipts-capture/noop-ocr.provider';
import { S3ObjectStorageProvider } from '../../src/modules/receipts-capture/s3-object-storage.provider';
import { parseReceiptLineItems } from '../../src/modules/receipts-capture/tesseract-ocr.provider';
import { DevUpiIntentProvider, ManualPaymentGateway } from '../../src/modules/settlements/manual-upi.providers';
import { RazorpayPaymentGatewayProvider } from '../../src/modules/settlements/razorpay-payment-gateway.provider';

describe('provider port contracts', () => {
  it('DevOtpProvider starts and verifies a deterministic development challenge', async () => {
    const provider = new DevOtpProvider({
      env: { OTP_DEV_CODE: '123456' },
      isProduction: false
    } as any);

    const started = await provider.start({
      challengeId: 'challenge-1',
      phoneE164: '+919876543210',
      expiresAt: new Date('2026-07-10T00:00:00.000Z'),
      purpose: 'login'
    });

    expect(started).toMatchObject({
      providerChallengeId: 'challenge-1',
      deliveryMode: 'development',
      devCode: '123456'
    });
    await expect(
      provider.verify({ providerChallengeId: 'challenge-1', phoneE164: '+919876543210', code: '123456' })
    ).resolves.toBe(true);
    await expect(
      provider.verify({ providerChallengeId: 'challenge-1', phoneE164: '+919876543210', code: '000000' })
    ).resolves.toBe(false);
  });

  it('DevNotificationProvider returns a provider message id without external delivery', async () => {
    const provider = new DevNotificationProvider();
    await expect(
      provider.deliver({
        notificationId: 'notification-1',
        userId: 'user-1',
        type: 'settlement_reminder',
        title: 'Settlement reminder',
        body: 'A payment is waiting for confirmation.'
      })
    ).resolves.toMatchObject({
      provider: 'dev',
      status: 'sent',
      providerMessageId: 'dev-notification-1'
    });
  });

  it('TwilioVerifyOtpProvider uses Verify endpoints and accepts approved checks', async () => {
    const calls: Array<{ url: string; body?: unknown }> = [];
    const provider = new TwilioVerifyOtpProvider(
      {
        env: {
          TWILIO_ACCOUNT_SID: 'AC-test',
          TWILIO_AUTH_TOKEN: 'secret',
          TWILIO_VERIFY_SERVICE_SID: 'VA-test'
        }
      } as any,
      async (url, init) => {
        calls.push({ url, body: init.body });
        return {
          ok: true,
          status: 200,
          json: async () => (url.includes('VerificationCheck') ? { status: 'approved' } : { sid: 'VE-test' })
        };
      }
    );

    await expect(
      provider.start({
        challengeId: 'challenge-twilio',
        phoneE164: '+919876543210',
        expiresAt: new Date(),
        purpose: 'login'
      })
    ).resolves.toMatchObject({ providerChallengeId: 'VE-test', deliveryMode: 'sms' });
    await expect(
      provider.verify({ providerChallengeId: 'VE-test', phoneE164: '+919876543210', code: '123456' })
    ).resolves.toBe(true);
    expect(calls.map((call) => call.url)).toEqual([
      'https://verify.twilio.com/v2/Services/VA-test/Verifications',
      'https://verify.twilio.com/v2/Services/VA-test/VerificationCheck'
    ]);
  });

  it('ExpoPushProvider queues messages for registered Expo push tokens', async () => {
    const provider = new ExpoPushProvider({ env: {} } as any, async (_url, init) => {
      expect(JSON.parse(String(init.body))[0]).toMatchObject({
        to: 'ExponentPushToken[test]',
        title: 'Settlement reminder'
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: [{ status: 'ok', id: 'ticket-1' }] })
      };
    });

    await expect(
      provider.deliver({
        notificationId: 'notification-1',
        userId: 'user-1',
        type: 'settlement_reminder',
        title: 'Settlement reminder',
        body: 'A payment is waiting.',
        targetPushTokens: ['ExponentPushToken[test]']
      })
    ).resolves.toMatchObject({ provider: 'expo', status: 'queued', providerMessageId: 'ticket-1' });
  });

  it('DevUpiIntentProvider creates a payer-initiated UPI URI and QR payload', () => {
    const provider = new DevUpiIntentProvider();
    const intent = provider.createIntent({
      settlementIntentId: 'settlement-1',
      payerParticipantId: 'payer-1',
      payeeParticipantId: 'payee-1',
      payeeVpa: 'alice@upi',
      payeeName: 'Alice',
      amountMinor: 12345,
      currencyCode: 'INR',
      note: 'Dinner settlement',
      ledgerReference: 'SS-REF-1'
    });

    expect(intent.providerReference).toBe('SS-REF-1');
    expect(intent.upiUri).toContain('upi://pay');
    expect(intent.upiUri).toContain('pa=alice%40upi');
    expect(intent.qrPayload).toBe(intent.upiUri);
  });

  it('ManualPaymentGateway reports unknown status for manual-proof MVP flows', () => {
    const gateway = new ManualPaymentGateway();
    expect(gateway.lookupPayment('SS-REF-1')).toEqual({
      providerReference: 'SS-REF-1',
      status: 'unknown'
    });
  });

  it('RazorpayPaymentGatewayProvider verifies signatures and normalizes payment callbacks', () => {
    const rawBody = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_test',
            amount: 5000,
            currency: 'INR',
            notes: {
              settlementIntentId: 'settlement-1',
              ledgerReference: 'SS-REF-1'
            },
            acquirer_data: { rrn: 'UTR123456' }
          }
        }
      }
    });
    const signature = createHmac('sha256', 'webhook-secret').update(rawBody).digest('hex');
    const provider = new RazorpayPaymentGatewayProvider({
      env: { RAZORPAY_WEBHOOK_SECRET: 'webhook-secret' }
    } as any);

    expect(provider.verifyWebhook({ rawBody, signature })).toMatchObject({
      providerReference: 'SS-REF-1',
      settlementIntentId: 'settlement-1',
      status: 'succeeded',
      amountMinor: 5000,
      currencyCode: 'INR',
      utr: 'UTR123456'
    });
    expect(() => provider.verifyWebhook({ rawBody, signature: 'bad' })).toThrow(/signature/);
  });

  it('SetuAccountAggregatorProvider creates consent sessions and normalizes bank transactions', async () => {
    const fetchFn = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/consents')) {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({
          'x-client-id': 'setu-client',
          'x-client-secret': 'setu-secret'
        });
        return {
          ok: true,
          json: async () => ({
            consentId: 'consent-1',
            status: 'PENDING',
            redirectUrl: 'https://aa.example/consent-1'
          })
        } as Response;
      }
      expect(url).toContain('/consents/consent-1/transactions?');
      return {
        ok: true,
        json: async () => ({
          transactions: [
            {
              transactionId: 'txn-1',
              date: '2026-07-10',
              narration: 'UPI groceries',
              amount: '250.75',
              currency: 'INR',
              direction: 'DEBIT'
            }
          ]
        })
      } as Response;
    });
    const provider = SetuAccountAggregatorProvider.withFetch(
      {
        env: {
          SETU_AA_BASE_URL: 'https://aa.setu.test',
          SETU_AA_CLIENT_ID: 'setu-client',
          SETU_AA_CLIENT_SECRET: 'setu-secret'
        }
      } as any,
      fetchFn as any
    );

    await expect(
      provider.createConsent({
        customerReference: 'user-1',
        phoneNumber: '+919876543210',
        fromDate: '2026-07-01',
        toDate: '2026-07-10'
      })
    ).resolves.toMatchObject({
      provider: 'setu_aa',
      consentId: 'consent-1',
      status: 'pending',
      redirectUrl: 'https://aa.example/consent-1'
    });

    await expect(
      provider.fetchTransactions({ consentId: 'consent-1', fromDate: '2026-07-01', toDate: '2026-07-10' })
    ).resolves.toEqual([
      expect.objectContaining({
        transactionId: 'txn-1',
        narration: 'UPI groceries',
        amountMinor: 25075,
        direction: 'debit'
      })
    ]);
  });

  it('NoopOcrProvider satisfies the OCR port without pretending OCR is complete', async () => {
    const provider = new NoopOcrProvider();
    await expect(provider.analyzeReceipt({ receiptDraftId: 'draft-1', attachmentId: 'attachment-1' })).resolves.toEqual({
      provider: 'noop',
      rawText: '',
      confidence: 0,
      items: [],
      needsHumanReview: true
    });
  });

  it('Tesseract receipt parser extracts review-only item candidates from OCR text', () => {
    expect(parseReceiptLineItems(['Masala dosa 120.00', 'Filter coffee ₹45', 'GST 8.10', 'Total 173.10'].join('\n'))).toEqual([
      { label: 'Masala dosa', amountMinor: 12000, currencyCode: 'INR', confidence: 0.72 },
      { label: 'Filter coffee', amountMinor: 4500, currencyCode: 'INR', confidence: 0.72 }
    ]);
  });

  it('LocalObjectStorageProvider persists uploaded bytes and reports content hash metadata', async () => {
    const storageRoot = await mkdtemp(path.join(tmpdir(), 'splitsaathi-storage-'));
    const previousStorageRoot = process.env.LOCAL_OBJECT_STORAGE_DIR;
    process.env.LOCAL_OBJECT_STORAGE_DIR = storageRoot;
    try {
      const provider = new LocalObjectStorageProvider();
      const buffer = Buffer.from('receipt bytes');
      const result = await provider.putObject({
        ownerUserId: 'user-1',
        purpose: 'receipt',
        originalName: 'receipt.txt',
        mimeType: 'text/plain',
        buffer
      });

      expect(result.storageProvider).toBe('local-filesystem');
      expect(result.storageKey).toContain('attachments/user-1/receipt/');
      expect(result.byteSize).toBe(buffer.length);
      expect(result.sha256).toBe('9e85aa95f04db5f108534e48b63e75e8045a7ecab59988405e70a9260300a0d6');
      await expect(readFile(path.join(storageRoot, ...result.storageKey.split('/')))).resolves.toEqual(buffer);
      await expect(provider.getObjectBuffer(result.storageKey)).resolves.toEqual(buffer);
    } finally {
      if (previousStorageRoot === undefined) {
        delete process.env.LOCAL_OBJECT_STORAGE_DIR;
      } else {
        process.env.LOCAL_OBJECT_STORAGE_DIR = previousStorageRoot;
      }
      await rm(storageRoot, { recursive: true, force: true });
    }
  });

  it('S3ObjectStorageProvider writes and reads through an S3-compatible client', async () => {
    const stored = new Map<string, Buffer>();
    const fakeClient = {
      putObject: jest.fn(async (_bucket: string, key: string, buffer: Buffer) => {
        stored.set(key, buffer);
      }),
      getObject: jest.fn(async (_bucket: string, key: string) => Readable.from([stored.get(key)!]))
    };
    const provider = S3ObjectStorageProvider.withClient(
      {
        env: {
          S3_BUCKET: 'splitsaathi-test',
          S3_ENDPOINT: 'http://localhost:9000',
          S3_ACCESS_KEY_ID: 'minio',
          S3_SECRET_ACCESS_KEY: 'minio123',
          S3_REGION: 'us-east-1',
          S3_USE_SSL: false
        }
      } as any,
      fakeClient as any
    );
    const result = await provider.putObject({
      ownerUserId: 'user-1',
      purpose: 'receipt',
      originalName: 'receipt.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('s3 receipt bytes')
    });

    expect(result.storageProvider).toBe('s3-compatible');
    await expect(provider.getObjectBuffer(result.storageKey)).resolves.toEqual(Buffer.from('s3 receipt bytes'));
    expect(fakeClient.putObject).toHaveBeenCalledWith(
      'splitsaathi-test',
      result.storageKey,
      Buffer.from('s3 receipt bytes'),
      Buffer.byteLength('s3 receipt bytes'),
      expect.any(Object)
    );
  });
});
