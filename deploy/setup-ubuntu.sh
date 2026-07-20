#!/usr/bin/env bash
# Idempotent host prep for Ubuntu (Node 20, Docker, nginx, PM2, ufw).
# Run once on a fresh VM:  bash deploy/setup-ubuntu.sh
set -euo pipefail

if [[ "${EUID}" -eq 0 ]]; then
  echo "Run this script as a normal user with sudo, not as root."
  exit 1
fi

echo "==> Updating apt"
sudo apt update
sudo apt upgrade -y

echo "==> Installing Node.js 20"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi
node -v
npm -v

echo "==> Installing Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo "Docker installed. Log out/in (or run 'newgrp docker') before docker compose."
fi

echo "==> Installing nginx + ufw + build tools"
sudo apt install -y nginx ufw build-essential python3

echo "==> Installing PM2"
sudo npm install -g pm2

echo "==> Firewall: SSH + nginx only"
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
sudo ufw status

echo ""
echo "Host prep done. Next:"
echo "  1. Clone/pull the repo to e.g. /opt/splitsaathi"
echo "  2. Follow deploy/README.md from 'Configure secrets' onward"
echo "  3. If Docker was just installed, re-login so your user can run docker"
