# Monthly settlement email cron

## Endpoint (already in API)
`POST /v1/jobs/monthly-settlement-summaries`
Header: `x-cron-secret: $CRON_SECRET`

## Install on the API host

```bash
chmod +x deploy/cron/monthly-settlement-summary.sh

# Edit paths if needed, then:
crontab -e
```

Add (08:00 on the 1st of each month, Asia/Kolkata — set TZ on the host or use UTC equivalent):

```
0 2 1 * * /home/neeraj/Neeraj/Splitsaathi/hostingsplitsaathi/splitsaathi/deploy/cron/monthly-settlement-summary.sh >> /var/log/splitsaathi-monthly-mail.log 2>&1
```

(Adjust the path to wherever the repo lives on the VM. `0 2` ≈ 08:00 IST if the host is UTC.)

## Required env (in `deploy/api.docker.env`)
- `CRON_SECRET` (≥16 chars)
- `EMAIL_PROVIDER_DRIVER=resend`
- `RESEND_API_KEY`
- `EMAIL_FROM=SplitSaathi <noreply@yourdomain>`
- Users must have `emailMonthlySummary=true` and a verified email
