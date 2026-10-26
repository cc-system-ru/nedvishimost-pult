#!/usr/bin/env bash
# Обновление пульта до последней версии из GitHub: sudo bash /opt/pult/deploy/update.sh
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR" && git pull --ff-only
cd app && npm ci --omit=dev
systemctl restart pult && sleep 2 && systemctl --no-pager status pult | head -3
echo "Обновлено."
