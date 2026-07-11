# Users Module

Owns the `users` table and authenticated user profile reads. Auth identities remain in `AuthModule`; groups consume `UsersService` only to resolve actor profile information.

Current endpoint:

- `GET /v1/users/me`

The module intentionally does not contain contact discovery, consent, group roles or financial data.
