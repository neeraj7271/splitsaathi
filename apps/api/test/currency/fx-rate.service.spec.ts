import { FxRateService } from '../../src/modules/currency';

describe('FxRateService', () => {
  it('returns identity rates without external calls', async () => {
    const service = new FxRateService({ env: { FX_PROVIDER_DRIVER: 'static' } } as any);
    await expect(service.getRate('INR', 'INR', '2026-07-10')).resolves.toMatchObject({
      baseCurrencyCode: 'INR',
      quoteCurrencyCode: 'INR',
      rateNumerator: 1,
      rateDenominator: 1
    });
  });

  it('converts integer minor units with explicit rounding delta', async () => {
    const service = new FxRateService({ env: { FX_PROVIDER_DRIVER: 'static' } } as any);
    const rate = await service.getRate('USD', 'INR', 'fixture');
    expect(service.convertMinor(123, rate)).toEqual({
      amountMinor: 10271,
      roundingDeltaMinor: 50
    });
  });
});
