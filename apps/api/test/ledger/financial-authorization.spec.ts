import { GroupsFinancialAuthorization } from '../../src/modules/ledger/financial-authorization';

describe('GroupsFinancialAuthorization', () => {
  it('maps financial actions to group permissions and lists readable groups', async () => {
    const groups = {
      assertPermission: jest.fn().mockResolvedValue(undefined),
      listGroups: jest.fn().mockResolvedValue([{ id: 'group-a' }, { id: 'group-b' }])
    };
    const authorization = new GroupsFinancialAuthorization(groups as any);

    await authorization.assertCan('user-1', 'group-a', 'expense.create');
    await authorization.assertCan('user-1', 'group-a', 'settlement.confirm');
    await authorization.assertCan('user-1', 'group-a', 'export');
    await expect(authorization.listReadableGroupIds('user-1')).resolves.toEqual(['group-a', 'group-b']);

    expect(groups.assertPermission).toHaveBeenNthCalledWith(1, 'user-1', 'group-a', 'financial.expense.create');
    expect(groups.assertPermission).toHaveBeenNthCalledWith(2, 'user-1', 'group-a', 'financial.settlement.confirm');
    expect(groups.assertPermission).toHaveBeenNthCalledWith(3, 'user-1', 'group-a', 'financial.export');
    expect(groups.listGroups).toHaveBeenCalledWith('user-1');
  });
});
