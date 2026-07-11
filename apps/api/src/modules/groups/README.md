# Groups Module

Owns groups, participants, memberships, role permissions, invites and member-exit locking.

Endpoints:

- `POST /v1/groups`
- `GET /v1/groups`
- `GET /v1/groups/:groupId`
- `POST /v1/groups/:groupId/invites`
- `POST /v1/groups/:groupId/participants`
- `PATCH /v1/groups/:groupId/memberships/:membershipId/role`
- `POST /v1/groups/:groupId/archive`
- `POST /v1/groups/:groupId/memberships/:membershipId/lock-exit`
- `POST /v1/groups/:groupId/obligation-transfers`

Boundaries:

- `group_role_permissions` stores per-group role permissions seeded from `DEFAULT_ROLE_PERMISSIONS`.
- `OBLIGATION_TRANSFER_PORT` is a ledger hook only. The default implementation validates the group request and returns `requires_ledger_module`; it does not create financial events or balances.
- Balance math, expenses, settlements and payment state are intentionally outside this module.
