import { Injectable } from '@nestjs/common';
import { GroupsService } from '../groups/groups.service';
import type { GroupPermission } from '../groups/policies/group-permissions';

export const FINANCIAL_AUTHORIZATION = 'FINANCIAL_AUTHORIZATION';

export type FinancialAction =
  | 'read'
  | 'expense.create'
  | 'expense.edit'
  | 'expense.void'
  | 'settlement.confirm'
  | 'export';

export interface FinancialAuthorizationPort {
  assertCan(userId: string, groupId: string, action: FinancialAction): Promise<void>;
  listReadableGroupIds(userId: string): Promise<string[] | undefined>;
}

const permissionByAction: Record<FinancialAction, GroupPermission> = {
  read: 'group.read',
  'expense.create': 'financial.expense.create',
  'expense.edit': 'financial.expense.edit.any',
  'expense.void': 'financial.expense.void',
  'settlement.confirm': 'financial.settlement.confirm',
  export: 'financial.export'
};

@Injectable()
export class AllowAllFinancialAuthorization implements FinancialAuthorizationPort {
  async assertCan(): Promise<void> {
    return undefined;
  }

  async listReadableGroupIds(): Promise<string[] | undefined> {
    return undefined;
  }
}

@Injectable()
export class GroupsFinancialAuthorization implements FinancialAuthorizationPort {
  constructor(private readonly groups: GroupsService) {}

  async assertCan(userId: string, groupId: string, action: FinancialAction): Promise<void> {
    await this.groups.assertPermission(userId, groupId, permissionByAction[action]);
  }

  async listReadableGroupIds(userId: string): Promise<string[]> {
    const groups = await this.groups.listGroups(userId);
    return groups.map((group) => group.id);
  }
}
