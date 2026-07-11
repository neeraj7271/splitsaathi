import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ApiConfigService } from '../../config/api-config.service';
import type { GatewayPaymentStatus, PaymentGatewayPort, PaymentGatewayWebhookInput } from './upi-provider.ports';

@Injectable()
export class RazorpayPaymentGatewayProvider implements PaymentGatewayPort {
  constructor(private readonly config: ApiConfigService) {}

  lookupPayment(providerReference: string): GatewayPaymentStatus {
    return {
      providerReference,
      status: 'unknown'
    };
  }

  verifyWebhook(input: PaymentGatewayWebhookInput): GatewayPaymentStatus {
    const secret = this.requireWebhookSecret();
    const expected = createHmac('sha256', secret).update(input.rawBody).digest('hex');
    if (!input.signature || !timingSafeEqualHex(expected, input.signature)) {
      throw new Error('Invalid Razorpay webhook signature.');
    }

    const payload = JSON.parse(input.rawBody) as Record<string, any>;
    const payment = payload.payload?.payment?.entity ?? payload.payment ?? payload;
    const amountMinor = Number.isInteger(payment.amount) ? payment.amount : undefined;
    const currencyCode = typeof payment.currency === 'string' ? payment.currency.toUpperCase() : undefined;
    const notes = payment.notes ?? {};
    const providerReference =
      String(notes.ledgerReference ?? notes.providerReference ?? payment.reference_id ?? payment.id ?? '');
    const settlementIntentId =
      typeof notes.settlementIntentId === 'string'
        ? notes.settlementIntentId
        : typeof payment.description === 'string' && payment.description.startsWith('splitsaathi:')
          ? payment.description.slice('splitsaathi:'.length)
          : undefined;
    const utr = payment.acquirer_data?.rrn ?? payment.acquirer_data?.upi_transaction_id ?? payment.utr;
    const eventName = String(payload.event ?? payment.status ?? '');

    return {
      providerReference,
      settlementIntentId,
      status: normalizeStatus(eventName, payment.status),
      amountMinor,
      currencyCode,
      utr: utr ? String(utr) : undefined,
      rawPayload: payload
    };
  }

  private requireWebhookSecret(): string {
    if (!this.config.env.RAZORPAY_WEBHOOK_SECRET) {
      throw new Error('RAZORPAY_WEBHOOK_SECRET is required when PAYMENT_GATEWAY_DRIVER=razorpay.');
    }
    return this.config.env.RAZORPAY_WEBHOOK_SECRET;
  }
}

function normalizeStatus(eventName: string, paymentStatus: unknown): GatewayPaymentStatus['status'] {
  if (/refund/i.test(eventName)) return 'refunded';
  if (/fail|error/i.test(eventName) || paymentStatus === 'failed') return 'failed';
  if (/captured|authorized|success|paid/i.test(eventName) || paymentStatus === 'captured') return 'succeeded';
  return 'pending';
}

function timingSafeEqualHex(left: string, right: string): boolean {
  const normalizedRight = right.trim();
  if (!/^[0-9a-f]+$/i.test(normalizedRight) || left.length !== normalizedRight.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(normalizedRight, 'hex'));
}
