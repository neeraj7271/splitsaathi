# Deploy SplitSaathi API on Ubuntu (nginx + PM2 + Docker Postgres/MinIO)

Architecture:

```
[React Native] --HTTP--> [nginx :80] --proxy--> [NestJS 127.0.0.1:3000]
                                                    |
                              [Postgres Docker 127.0.0.1:5432]
                              [MinIO Docker 127.0.0.1:9000]
```

Only nginx is public. Postgres and MinIO bind to localhost. Nest listens on `127.0.0.1`.

## 1. One-time host prep

SSH into the VM, then:

```bash
# clone the repo somewhere stable
sudo mkdir -p /opt/splitsaathi
sudo chown "$USER:$USER" /opt/splitsaathi
cd /opt/splitsaathi
git clone <YOUR_REPO_URL> .

bash deploy/setup-ubuntu.sh
# if Docker was newly installed:
newgrp docker   # or log out/in
```

## 2. Configure secrets

```bash
cp deploy/env.example deploy/.env
cp deploy/env.example apps/api/.env
```

Edit **both** files and replace every `CHANGE_ME_*` and `YOUR_VM_PUBLIC_IP`.

Important fields in `apps/api/.env`:

| Key | Value |
|-----|--------|
| `HOST` | `127.0.0.1` |
| `DATABASE_URL` | `postgres://splitsaathi:<password>@127.0.0.1:5432/splitsaathi` |
| `APP_PUBLIC_URL` / `MOBILE_API_URL` | `http://YOUR_VM_PUBLIC_IP` |
| `ALLOW_INSECURE_DEV_PROVIDERS` | `true` for early testing (OTP code `123456`) |
| `S3_ENDPOINT` | `http://127.0.0.1:9000` |
| `S3_SECRET_ACCESS_KEY` | same as `MINIO_ROOT_PASSWORD` |

Generate secrets:

```bash
openssl rand -base64 32   # use for JWT_* and passwords
```

## 3. nginx

```bash
sudo sed "s/YOUR_VM_PUBLIC_IP/$(curl -s ifconfig.me || echo _)/" \
  deploy/nginx/splitsaathi.conf | sudo tee /etc/nginx/sites-available/splitsaathi >/dev/null
# Or manually edit server_name to your IP.

sudo ln -sf /etc/nginx/sites-available/splitsaathi /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 4. Start everything

```bash
bash deploy/start.sh
pm2 startup    # run the command it prints, once
pm2 save
```

## 5. Verify

```bash
curl -s http://127.0.0.1:3000/v1/health/live
curl -s http://127.0.0.1:3000/v1/health/ready
curl -s http://YOUR_VM_PUBLIC_IP/v1/health/live
# Swagger: http://YOUR_VM_PUBLIC_IP/docs
```

Dev OTP (with `ALLOW_INSECURE_DEV_PROVIDERS=true`): use code `123456`.

## 6. Point the mobile app at the VM

In `apps/mobile/.env` (or EAS / Expo env):

```bash
EXPO_PUBLIC_API_URL=http://YOUR_VM_PUBLIC_IP
```

Rebuild / restart Expo. Android cleartext HTTP needs `usesCleartextTraffic` (or a network security config) until you have HTTPS. iOS needs an ATS exception until then.

## Day-2 operations

```bash
# logs
pm2 logs splitsaathi-api
docker compose -f deploy/docker-compose.yml logs -f

# after git pull
bash deploy/start.sh

# DB backup
docker exec splitsaathi_postgres pg_dump -U splitsaathi splitsaathi > "backup-$(date +%F).sql"

# stop API only
pm2 stop splitsaathi-api
```

## Before real users

1. Set `ALLOW_INSECURE_DEV_PROVIDERS=false`
2. Wire Twilio / Resend / Expo push / Razorpay (or keep features off)
3. Point a domain at the VM and run:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

4. Switch mobile `EXPO_PUBLIC_API_URL` to `https://yourdomain.com` and remove cleartext exceptions
5. Update `APP_PUBLIC_URL` / `MOBILE_API_URL` to HTTPS and restart PM2

## Troubleshooting

| Symptom | Check |
|---------|--------|
| `ECONNREFUSED` from phone | Firewall / nginx; `curl` health from your laptop |
| Nest crash on boot | `pm2 logs`; usually missing env or `ALLOW_INSECURE_DEV_PROVIDERS` |
| Migration fails | Postgres up? `DATABASE_URL` password match `deploy/.env`? |
| Uploads fail | MinIO up? `S3_ENDPOINT=http://127.0.0.1:9000` and matching credentials |
| Port 3000 reachable from internet | Nest must use `HOST=127.0.0.1`; do not `ufw allow 3000` |
