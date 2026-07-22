import { MembershipRole } from '@splitsaathi/contracts';

export const GroupPermissions = [
  'group.read',
  'group.update',
  'group.invite.create',
  'participant.create',
  'membership.role.update',
  'group.archive',
  'membership.exit.lock',
  'obligation_transfer.create',
  'financial.expense.create',
  'financial.expense.edit.any',
  'financial.expense.void',
  'financial.settlement.confirm',
  'financial.export'
] as const;

export type GroupPermission = (typeof GroupPermissions)[number];

export const DEFAULT_ROLE_PERMISSIONS: Record<MembershipRole, GroupPermission[]> = {
  owner: [...GroupPermissions],
  admin: [
    'group.read',
    'group.update',
    'group.invite.create',
    'participant.create',
    'membership.role.update',
    'group.archive',
    'membership.exit.lock',
    'obligation_transfer.create',
    'financial.expense.create',
    'financial.expense.edit.any',
    'financial.expense.void',
    'financial.settlement.confirm',
    'financial.export'
  ],
  member: [
    'group.read',
    'group.invite.create',
    'participant.create',
    'financial.expense.create',
    'financial.settlement.confirm'
  ],
  viewer: ['group.read']
};

export function permissionsForRole(role: MembershipRole): GroupPermission[] {
  return DEFAULT_ROLE_PERMISSIONS[role] ?? [];
}
