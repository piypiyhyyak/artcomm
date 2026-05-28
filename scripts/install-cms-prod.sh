#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/Artcomm}"
SERVICE_NAME="${SERVICE_NAME:-artcomm-cms.service}"
SERVICE_SRC="$APP_DIR/deploy/systemd/artcomm-cms.service"
SERVICE_DST="/etc/systemd/system/$SERVICE_NAME"

if [ ! -f "$SERVICE_SRC" ]; then
  echo "Missing service template: $SERVICE_SRC" >&2
  exit 1
fi

install -D -m 0644 "$SERVICE_SRC" "$SERVICE_DST"
mkdir -p /var/lib/artcomm-cms /var/www/html/assets
chown -R www-data:www-data /var/lib/artcomm-cms /var/www/html/assets

systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"
systemctl status "$SERVICE_NAME" --no-pager

echo "Service installed: $SERVICE_NAME"
echo "Add deploy/nginx/cms-proxy-location.conf into your active nginx server block, then run nginx -t && systemctl restart nginx"
