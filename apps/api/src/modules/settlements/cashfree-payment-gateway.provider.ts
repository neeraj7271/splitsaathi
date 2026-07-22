import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ApiConfigService } from '../../config/api-config.service';
import type { GatewayPaymentStatus, PaymentGatewayPort, PaymentGatewayWebhookInput } from './upi-provider.ports';

/**
 * Cashfree Payment Gateway adapter.
 * Webhook signature: HMAC-SHA256(timestamp + rawBody, secretKey) → base64
 * @see https://www.cashfree.com/docs/payments/online/webhooks/signature-verification
 */
@Injectable()
export class CashfreePaymentGatewayProvider implements PaymentGatewayPort {
  constructor(private readonly config: ApiConfigService) {}

  lookupPayment(providerReference: string): GatewayPaymentStatus {
    return {
      providerReference,
      status: 'unknown'
    };
  }

  verifyWebhook(input: PaymentGatewayWebhookInput): GatewayPaymentStatus {
    const secret = this.requireSecretKey();
    const timestamp = input.timestamp?.trim();
    if (!timestamp) {
      throw new Error('Missing Cashfree x-webhook-timestamp header.');
    }
    if (!input.signature) {
      throw new Error('Missing Cashfree x-webhook-signature header.');
    }

    const expected = createHmac('sha256', secret)
      .update(timestamp + input.rawBody)
      .digest('base64');
    if (!timingSafeEqualString(expected, input.signature.trim())) {
      throw new Error('Invalid Cashfree webhook signature.');
    }

    const payload = JSON.parse(input.rawBody) as Record<string, any>;
    const data = payload.data ?? payload;
    const order = data.order ?? {};
    const payment = data.payment ?? {};
    const tags = (order.order_tags ?? payment.order_tags ?? {}) as Record<string, unknown>;

    const amountMajor = payment.payment_amount ?? order.order_amount;
    const amountMinor =
      typeof amountMajor === 'number'
        ? Math.round(amountMajor * 100)
        : typeof amountMajor === 'string' && amountMajor.trim()
          ? Math.round(Number(amountMajor) * 100)
          : undefined;

    const currencyCode =
      typeof payment.payment_currency === 'string'
        ? payment.payment_currency.toUpperCase()
        : typeof order.order_currency === 'string'
          ? order.order_currency.toUpperCase()
          : undefined;

    const ledgerFromTags =
      typeof tags.ledgerReference === 'string'
        ? tags.ledgerReference
        : typeof tags.providerReference === 'string'
          ? tags.providerReference
          : undefined;

    const providerReference = String(
      ledgerFromTags ?? order.order_id ?? payment.cf_payment_id ?? payment.payment_id ?? ''
    );

    const settlementIntentId =
      typeof tags.settlementIntentId === 'string'
        ? tags.settlementIntentId
        : typeof order.order_id === 'string' && order.order_id.startsWith('splitsaathi:')
          ? order.order_id.slice('splitsaathi:'.length)
          : undefined;

    const utr =
      payment.bank_reference ??
      payment.payment_method?.upi?.upi_rrn ??
      payment.utr;

    const eventName = String(payload.type ?? payload.event ?? payment.payment_status ?? '');

    return {
      providerReference,
      settlementIntentId,
      status: normalizeStatus(eventName, payment.payment_status),
      amountMinor: Number.isFinite(amountMinor) ? amountMinor : undefined,
      currencyCode,
      utr: utr ? String(utr) : undefined,
      rawPayload: payload
    };
  }

  private requireSecretKey(): string {
    const secret = this.config.env.CASHFREE_SECRET_KEY ?? this.config.env.CASHFREE_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error('CASHFREE_SECRET_KEY is required when PAYMENT_GATEWAY_DRIVER=cashfree.');
    }
    return secret;
  }
}

function normalizeStatus(eventName: string, paymentStatus: unknown): GatewayPaymentStatus['status'] {
  const combined = `${eventName} ${String(paymentStatus ?? '')}`;
  if (/refund|reversed/i.test(combined)) return 'refunded';
  if (/fail|error|user_dropped|dropped|cancelled|canceled/i.test(combined)) return 'failed';
  if (/success|paid|captured|completed/i.test(combined) || paymentStatus === 'SUCCESS') return 'succeeded';
  if (/pending/i.test(combined) || paymentStatus === 'PENDING') return 'pending';
  return 'pending';
}

function timingSafeEqualString(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left);
  const rightBuf = Buffer.from(right);
  if (leftBuf.length !== rightBuf.length) {
    return false;
  }
  return timingSafeEqual(leftBuf, rightBuf);
}
