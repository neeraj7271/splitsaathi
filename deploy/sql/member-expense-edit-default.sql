-- Members can edit/void expenses by default (admins can restrict in group settings).
INSERT INTO group_role_permissions (id, group_id, role, permission, allowed)
SELECT gen_random_uuid(), g.id, 'member', perms.permission, TRUE
FROM groups g
CROSS JOIN (
  VALUES
    ('financial.expense.edit.any'),
    ('financial.expense.void')
) AS perms(permission)
WHERE NOT EXISTS (
  SELECT 1
  FROM group_role_permissions grp
  WHERE grp.group_id = g.id
    AND grp.role = 'member'
    AND grp.permission = perms.permission
);
