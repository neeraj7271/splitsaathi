# Auth Module

Owns phone OTP login, auth identities and refresh sessions.

Endpoints:

- `POST /v1/auth/otp/start`
- `POST /v1/auth/otp/verify`
- `POST /v1/auth/refresh`

Provider boundaries:

- `OtpProviderPort` abstracts OTP delivery and verification.
- `DevOtpProvider` is intentionally development-only behavior that accepts `OTP_DEV_CODE`.

Production work still needed: replace the dev OTP adapter with a real SMS or WhatsApp provider, add rate limiting, and wire refresh-session device metadata from the mobile client.
