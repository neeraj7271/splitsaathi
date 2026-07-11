import type { MembershipRole } from '@splitsaathi/contracts';

export type Permission =
  | 'expense_create'
  | 'expense_edit_own'
  | 'expense_edit_any'
  | 'expense_void'
  | 'settlement_confirm'
  | 'member_invite'
  | 'member_role_change'
  | 'export'
  | 'archive';

const defaults: Record<MembershipRole, Permission[]> = {
  owner: [
    'expense_create',
    'expense_edit_own',
    'expense_edit_any',
    'expense_void',
    'settlement_confirm',
    'member_invite',
    'member_role_change',
    'export',
    'archive'
  ],
  admin: [
    'expense_create',
    'expense_edit_own',
    'expense_edit_any',
    'expense_void',
    'settlement_confirm',
    'member_invite',
    'export'
  ],
  member: ['expense_create', 'expense_edit_own', 'settlement_confirm'],
  viewer: []
};

export class AuthorizationPolicy {
  can(role: MembershipRole, permission: Permission): boolean {
    return defaults[role].includes(permission);
  }
}
