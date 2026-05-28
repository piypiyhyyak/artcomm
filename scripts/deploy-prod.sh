#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/Artcomm}"
WEB_ROOT="${WEB_ROOT:-/var/www/html}"
CMS_SERVICE="${CMS_SERVICE:-artcomm-cms}"
MP4_PATH="$WEB_ROOT/assets/gimn-ed-zy9mar.mp4"
MP4_BACKUP="/tmp/gimn-ed-zy9mar.mp4.bak"

cd "$APP_DIR"

git checkout main
git pull --ff-only origin main
npm install
npm run build

mkdir -p "$WEB_ROOT/assets"
if [ -f "$MP4_PATH" ]; then
  cp "$MP4_PATH" "$MP4_BACKUP"
fi

rm -rf "$WEB_ROOT"/*
cp -r dist/* "$WEB_ROOT/"

if [ -f "$MP4_BACKUP" ]; then
  mv "$MP4_BACKUP" "$MP4_PATH"
fi

if id -u www-data >/dev/null 2>&1; then
  chown -R www-data:www-data "$WEB_ROOT/assets"
  chmod -R u+rwX,g+rwX "$WEB_ROOT/assets"
fi

if systemctl list-unit-files | grep -q "^${CMS_SERVICE}\\.service"; then
  systemctl restart "$CMS_SERVICE"
fi

nginx -t
systemctl restart nginx

echo "Deploy complete"
