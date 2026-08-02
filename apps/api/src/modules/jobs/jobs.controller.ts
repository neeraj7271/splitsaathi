import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CronSecretGuard } from './cron-secret.guard';
import { MonthlySummaryMailService, type MonthlySummaryJobResult } from './monthly-summary-mail.service';

/**
 * External cron job endpoints.
 *
 * Example (scheduled via host cron at 08:00 IST on the 1st — see deploy/cron/README.md):
 *   curl -X POST "$APP_PUBLIC_URL/v1/jobs/monthly-settlement-summaries" \
 *     -H "x-cron-secret: $CRON_SECRET"
 *
 * Requires CRON_SECRET in the API environment. Uses EMAIL_PROVIDER_DRIVER
 * (dev logs locally; brevo or resend when configured).
 */
@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly monthlySummaries: MonthlySummaryMailService) {}

  @Public()
  @UseGuards(CronSecretGuard)
  @ApiHeader({ name: 'x-cron-secret', required: true, description: 'Must match CRON_SECRET env var.' })
  @Post('monthly-settlement-summaries')
  async runMonthlySettlementSummaries(): Promise<MonthlySummaryJobResult> {
    return this.monthlySummaries.sendMonthlySettlementSummaries();
  }
}
