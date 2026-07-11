import { Injectable } from '@nestjs/common';
import { ApiConfigService } from '../../config/api-config.service';

export interface FxRateSnapshot {
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  rateNumerator: number;
  rateDenominator: number;
  provider: string;
  asOf: string;
}

@Injectable()
export class FxRateService {
  private readonly fetchFn: typeof fetch = fetch;

  constructor(private readonly config: ApiConfigService) {}

  async getRate(baseCurrencyCode: string, quoteCurrencyCode: string, asOf?: string): Promise<FxRateSnapshot> {
    const base = baseCurrencyCode.toUpperCase();
    const quote = quoteCurrencyCode.toUpperCase();
    if (base === quote) {
      return {
        baseCurrencyCode: base,
        quoteCurrencyCode: quote,
        rateNumerator: 1,
        rateDenominator: 1,
        provider: 'identity',
        asOf: asOf ?? new Date().toISOString().slice(0, 10)
      };
    }
    if (this.config.env.FX_PROVIDER_DRIVER === 'static') {
      return staticRate(base, quote, asOf);
    }
    const datePath = asOf ?? 'latest';
    const url = `${this.config.env.FRANKFURTER_BASE_URL.replace(/\/$/, '')}/${datePath}?from=${encodeURIComponent(base)}&to=${encodeURIComponent(quote)}`;
    const response = await this.fetchFn(url);
    if (!response.ok) {
      throw new Error(`Frankfurter FX request failed with status ${response.status}.`);
    }
    const payload = (await response.json()) as { date?: string; rates?: Record<string, number> };
    const rate = payload.rates?.[quote];
    if (!rate) {
      throw new Error(`FX rate ${base}/${quote} was not returned by Frankfurter.`);
    }
    const rational = decimalToRational(rate);
    return {
      baseCurrencyCode: base,
      quoteCurrencyCode: quote,
      rateNumerator: rational.numerator,
      rateDenominator: rational.denominator,
      provider: 'frankfurter',
      asOf: payload.date ?? datePath
    };
  }

  convertMinor(amountMinor: number, rate: FxRateSnapshot): { amountMinor: number; roundingDeltaMinor: number } {
    const exactNumerator = amountMinor * rate.rateNumerator;
    const floor = Math.trunc(exactNumerator / rate.rateDenominator);
    const remainder = Math.abs(exactNumerator % rate.rateDenominator);
    const rounded = remainder * 2 >= rate.rateDenominator ? floor + Math.sign(exactNumerator) : floor;
    return {
      amountMinor: rounded,
      roundingDeltaMinor: rounded * rate.rateDenominator - exactNumerator
    };
  }
}

function decimalToRational(value: number): { numerator: number; denominator: number } {
  const fixed = value.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  const [, decimals = ''] = fixed.split('.');
  const denominator = 10 ** decimals.length;
  return {
    numerator: Math.round(value * denominator),
    denominator
  };
}

function staticRate(base: string, quote: string, asOf?: string): FxRateSnapshot {
  const key = `${base}:${quote}`;
  const rates: Record<string, number> = {
    'USD:INR': 8350,
    'EUR:INR': 9100,
    'GBP:INR': 10600,
    'INR:USD': 12,
    'INR:EUR': 11,
    'INR:GBP': 9
  };
  const numerator = rates[key];
  if (!numerator) {
    throw new Error(`No static FX fixture exists for ${base}/${quote}.`);
  }
  return {
    baseCurrencyCode: base,
    quoteCurrencyCode: quote,
    rateNumerator: numerator,
    rateDenominator: 100,
    provider: 'static',
    asOf: asOf ?? 'fixture'
  };
}
