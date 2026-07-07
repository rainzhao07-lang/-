#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/benmingmao-h5"
LOG_DIR="/var/log/benmingmao-h5"

sudo apt update
sudo apt install -y nginx git curl ca-certificates

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

sudo mkdir -p "$APP_DIR" "$LOG_DIR" /var/www/certbot
sudo chown -R "$USER:$USER" "$APP_DIR" "$LOG_DIR"

echo "Server base environment is ready."
echo "Upload project files to: $APP_DIR"
echo "Then run: npm ci && npm run build && pm2 start deploy/ecosystem.config.cjs && pm2 save"
