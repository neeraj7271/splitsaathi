import { AuthorizationPolicy } from './authorization-policy';

describe('AuthorizationPolicy', () => {
  it('allows owners to archive and prevents viewers from creating expenses', () => {
    const policy = new AuthorizationPolicy();
    expect(policy.can('owner', 'archive')).toBe(true);
    expect(policy.can('viewer', 'expense_create')).toBe(false);
  });
});
