import type { MembershipRole } from '@splitsaathi/contracts';
export type Permission = 'expense_create' | 'expense_edit_own' | 'expense_edit_any' | 'expense_void' | 'settlement_confirm' | 'member_invite' | 'member_role_change' | 'export' | 'archive';
export declare class AuthorizationPolicy {
    can(role: MembershipRole, permission: Permission): boolean;
}
