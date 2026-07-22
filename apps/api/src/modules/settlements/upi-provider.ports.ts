export interface CreateUpiIntentInput {
  settlementIntentId: string;
  payerParticipantId: string;
  payeeParticipantId: string;
  payeeVpa: string;
  payeeName: string;
  amountMinor: number;
  currencyCode: string;
  note: string;
  ledgerReference: string;
}

export interface CreatedUpiIntent {
  providerReference: string;
  upiUri: string;
  qrPayload: string;
  expiresAt: string;
}

export interface UpiIntentProviderPort {
  createIntent(input: CreateUpiIntentInput): CreatedUpiIntent;
}

export interface GatewayPaymentStatus {
  providerReference: string;
  status: 'unknown' | 'pending' | 'succeeded' | 'failed' | 'reversed' | 'refunded';
  amountMinor?: number;
  currencyCode?: string;
  utr?: string;
  settlementIntentId?: string;
  rawPayload?: Record<string, unknown>;
}

export interface PaymentGatewayPort {
  lookupPayment(providerReference: string): GatewayPaymentStatus;
  verifyWebhook?(input: PaymentGatewayWebhookInput): GatewayPaymentStatus;
}

export interface PaymentGatewayWebhookInput {
  rawBody: string;
  signature?: string;
  /** Cashfree: value of x-webhook-timestamp (joined with rawBody for HMAC). */
  timestamp?: string;
}

export const UPI_INTENT_PROVIDER = 'UPI_INTENT_PROVIDER';
export const PAYMENT_GATEWAY_PROVIDER = 'PAYMENT_GATEWAY_PROVIDER';
