import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FxRateService } from './fx-rate.service';

@ApiTags('currency')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('currency')
export class CurrencyController {
  constructor(private readonly fx: FxRateService) {}

  @Get('fx-rate')
  async getRate(@Query('base') base: string, @Query('quote') quote: string, @Query('asOf') asOf?: string) {
    return this.fx.getRate(base, quote, asOf);
  }

  @Get('convert')
  async convert(
    @Query('amountMinor') amountMinor: string,
    @Query('base') base: string,
    @Query('quote') quote: string,
    @Query('asOf') asOf?: string
  ) {
    const rate = await this.fx.getRate(base, quote, asOf);
    return {
      rate,
      ...this.fx.convertMinor(Number.parseInt(amountMinor, 10), rate)
    };
  }
}
