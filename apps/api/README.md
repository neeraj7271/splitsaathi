# SplitSaathi API

NestJS REST API for the mobile client. This workspace owns bootstrap, configuration, Swagger, auth/users, groups and notifications plumbing. Financial ledger, expense and settlement command logic intentionally lives outside this slice.

## Local Commands

- `npm run start:dev -w @splitsaathi/api`
- `npm run build -w @splitsaathi/api`
- `npm run test -w @splitsaathi/api`

Swagger is available at `/docs` when the API is running. Versioned endpoints are mounted under `/v1`.

## Development Auth

The current OTP adapter is `DevOtpProvider`. It accepts `OTP_DEV_CODE` from the environment and logs delivery metadata. Replace it with a production SMS/WhatsApp provider behind `OtpProviderPort`; controller and use-case code should not change.
