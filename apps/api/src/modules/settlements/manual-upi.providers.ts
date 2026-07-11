import { UpiUriBuilder } from '@splitsaathi/domain';
import type {
  CreateUpiIntentInput,
  CreatedUpiIntent,
  GatewayPaymentStatus,
  PaymentGatewayPort,
  UpiIntentProviderPort
} from './upi-provider.ports';

export class DevUpiIntentProvider implements UpiIntentProviderPort {
  private readonly builder = new UpiUriBuilder();

  createIntent(input: CreateUpiIntentInput): CreatedUpiIntent {
    const upiUri = this.builder.build({
      payeeVpa: input.payeeVpa,
      payeeName: input.payeeName,
      amountMinor: input.amountMinor,
      currencyCode: input.currencyCode,
      note: input.note,
      transactionReference: input.ledgerReference
    });
    return {
      providerReference: input.ledgerReference,
      upiUri,
      qrPayload: upiUri,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    };
  }
}

export class ManualPaymentGateway implements PaymentGatewayPort {
  lookupPayment(providerReference: string): GatewayPaymentStatus {
    return {
      providerReference,
      status: 'unknown'
    };
  }
}
