#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/rasyid-puteraa/current"
APP_NAME="rasyid-puteraa"

cd "$APP_DIR"
git pull --ff-only
pm2 restart "$APP_NAME" --update-env
pm2 save

echo "Deploy selesai: $(date '+%Y-%m-%d %H:%M:%S %Z')"
