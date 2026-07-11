import { EntitlementsService } from '../../src/modules/entitlements';

describe('EntitlementsService', () => {
  it('keeps core ledger commands uncapped', () => {
    const service = new EntitlementsService();

    expect(service.evaluateCoreCommand('user-1', 'expense.create')).toEqual({
      allowed: true,
      cap: null,
      reason: 'expense.create is a core ledger command and is not scarcity-capped.'
    });
    expect(service.evaluateCoreCommand('user-1', 'settlement.confirm').allowed).toBe(true);
    expect(service.evaluateCoreCommand('user-1', 'offline.batch').cap).toBeNull();
  });

  it('separates future paid automation from core ledger availability', () => {
    const service = new EntitlementsService();

    expect(service.evaluateAutomationFeature('user-1', 'ocr.receipt_itemizer')).toMatchObject({
      allowed: false,
      cap: null
    });
    expect(service.evaluateCoreCommand('user-1', 'expense.create').allowed).toBe(true);
  });
});
