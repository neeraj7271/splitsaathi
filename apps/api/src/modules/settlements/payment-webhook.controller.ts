import { Body, Controller, Headers, Inject, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { SettlementCommandService } from './settlement-command.service';
import { PAYMENT_GATEWAY_PROVIDER, type PaymentGatewayPort } from './upi-provider.ports';

@ApiTags('payments')
@Controller('payments')
export class PaymentWebhookController {
  constructor(
    private readonly settlements: SettlementCommandService,
    @Inject(PAYMENT_GATEWAY_PROVIDER) private readonly gateway: PaymentGatewayPort
  ) {}

  @Public()
  @Post('razorpay/webhook')
  async razorpayWebhook(
    @Req() request: Request & { rawBody?: string },
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Body() body: unknown
  ) {
    if (!this.gateway.verifyWebhook) {
      throw new Error('Configured payment gateway does not support webhooks.');
    }
    const rawBody = request.rawBody ?? JSON.stringify(body);
    const status = this.gateway.verifyWebhook({ rawBody, signature });
    return this.settlements.recordGatewayPayment({
      idempotencyKey: `razorpay:webhook:${status.providerReference}:${status.utr ?? 'no-utr'}`,
      actorId: 'payment-gateway:razorpay',
      status
    });
  }
}
