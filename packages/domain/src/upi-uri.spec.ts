import { UpiUriBuilder } from './upi-uri';

describe('UpiUriBuilder', () => {
  it('builds a payer-initiated INR UPI URI with exact amount and reference', () => {
    const uri = new UpiUriBuilder().build({
      payeeVpa: 'priya@upi',
      payeeName: 'Priya',
      amountMinor: 12345,
      note: 'SplitSaathi settlement',
      transactionReference: 'SS-123'
    });

    expect(uri).toContain('upi://pay?');
    expect(decodeURIComponent(uri)).toContain('pa=priya@upi');
    expect(decodeURIComponent(uri)).toContain('am=123.45');
    expect(decodeURIComponent(uri)).toContain('tr=SS-123');
  });

  it('encodes payee names, notes, and references without losing UPI parameters', () => {
    const uri = new UpiUriBuilder().build({
      payeeVpa: 'priya.rao-1@okicici',
      payeeName: 'Priya Rao & Co',
      amountMinor: 999,
      currencyCode: 'INR',
      note: 'Dinner + cab / July',
      transactionReference: 'SS REF/42'
    });
    const params = new URLSearchParams(uri.split('?')[1]);

    expect(params.get('pa')).toBe('priya.rao-1@okicici');
    expect(params.get('pn')).toBe('Priya Rao & Co');
    expect(params.get('am')).toBe('9.99');
    expect(params.get('tn')).toBe('Dinner + cab / July');
    expect(params.get('tr')).toBe('SS REF/42');
  });

  it('rejects non-INR, non-positive amounts, decimal minor units, and invalid VPAs', () => {
    const builder = new UpiUriBuilder();
    const valid = {
      payeeVpa: 'priya@upi',
      payeeName: 'Priya',
      amountMinor: 100,
      note: 'Settlement',
      transactionReference: 'SS-123'
    };

    expect(() => builder.build({ ...valid, currencyCode: 'USD' })).toThrow(/INR/);
    expect(() => builder.build({ ...valid, amountMinor: 0 })).toThrow(/positive integer/);
    expect(() => builder.build({ ...valid, amountMinor: 10.5 })).toThrow(/positive integer/);
    expect(() => builder.build({ ...valid, payeeVpa: '' })).toThrow(/VPA/);
    expect(() => builder.build({ ...valid, payeeVpa: 'not-a-vpa' })).toThrow(/VPA/);
  });
});
