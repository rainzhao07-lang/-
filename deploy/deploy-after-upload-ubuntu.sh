#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/benmingmao-h5"

cd "$APP_DIR"
npm ci
npm run build

sudo mkdir -p /var/log/benmingmao-h5
sudo chown -R "$USER:$USER" /var/log/benmingmao-h5

pm2 delete benmingmao-h5 >/dev/null 2>&1 || true
pm2 start deploy/ecosystem.config.cjs
pm2 save

sudo nginx -t
sudo systemctl reload nginx

echo "Deployment finished."
