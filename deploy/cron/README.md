# Monthly settlement email cron

Schedule: **08:00 IST (Asia/Kolkata)** on the **1st of every month**.

## Endpoint (already in API)

`POST /v1/jobs/monthly-settlement-summaries`  
Header: `x-cron-secret: $CRON_SECRET`

## Who receives an email

For each **active** group, every **active / locked_for_exit** member gets **one email per group** when all of these are true:

| Requirement | Details |
|-------------|---------|
| Linked account | `membership.userId` is set (not a phone-only placeholder) |
| Opt-in | `emailMonthlySummary` is not `false` (default **on**) |
| Deliverable email | Verified email credential **or** `auth_identities` row with `provider=email` (Google sign-in creates this) |
| Preference UI | Users can turn off in app → Notification settings |

Skipped users are counted in the job response (`skipped`). Failed Brevo sends are logged and counted (`emailsFailed`) without stopping other recipients.

## Install on the API host

```bash
chmod +x deploy/cron/monthly-settlement-summary.sh
crontab -e
```

Add these two lines (adjust the script path to your server checkout):

```cron
CRON_TZ=Asia/Kolkata
0 8 1 * * /home/neeraj/Neeraj/Splitsaathi/hostingsplitsaathi/splitsaathi/deploy/cron/monthly-settlement-summary.sh >> /var/log/splitsaathi-monthly-mail.log 2>&1
```

`CRON_TZ=Asia/Kolkata` makes `0 8` mean **08:00 India time**, regardless of the host's system timezone.

Verify:

```bash
crontab -l | grep -A1 CRON_TZ
```

## Required env (in `deploy/api.docker.env`)

- `CRON_SECRET` (≥16 chars)
- Email provider (pick one):
  - **Brevo (recommended):** `EMAIL_PROVIDER_DRIVER=brevo`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`
  - **Resend:** `EMAIL_PROVIDER_DRIVER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`
- Sender address must use a verified domain in Brevo/Resend
- Users must have `emailMonthlySummary=true` and a verified email

## Manual test

```bash
./deploy/cron/monthly-settlement-summary.sh
```

Logs use `Asia/Kolkata` timestamps (script sets `TZ=Asia/Kolkata`).
