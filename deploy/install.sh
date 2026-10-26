#!/usr/bin/env bash
# Установка пульта на чистый сервер Ubuntu 22.04 / 24.04.
# Запуск:  sudo bash /opt/pult/deploy/install.sh pult.vash-domen.ru
# Без домена: sudo bash /opt/pult/deploy/install.sh   (пульт будет по http://IP-сервера)
set -euo pipefail
DOMAIN="${1:-}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "== Папка приложения: $APP_DIR"

echo "== 1/5 Системные пакеты"
apt-get update -y
apt-get install -y curl git ca-certificates gnupg build-essential python3 debian-keyring debian-archive-keyring apt-transport-https

echo "== 2/5 Node.js 20"
if ! command -v node >/dev/null || [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "== 3/5 Зависимости приложения"
id pult >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin pult
cd "$APP_DIR/app" && npm ci --omit=dev
[ -f "$APP_DIR/.env" ] || cp "$APP_DIR/.env.example" "$APP_DIR/.env"
if [ -n "$DOMAIN" ]; then sed -i 's/^COOKIE_SECURE=.*/COOKIE_SECURE=1/' "$APP_DIR/.env"; fi
mkdir -p "$APP_DIR/data" && chown -R pult:pult "$APP_DIR/data"

echo "== 4/5 Служба systemd"
cat > /etc/systemd/system/pult.service <<UNIT
[Unit]
Description=Пульт агентства
After=network.target

[Service]
User=pult
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
Environment=DATA_DIR=$APP_DIR/data
ExecStart=/usr/bin/node $APP_DIR/app/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now pult
sleep 2; systemctl --no-pager status pult | head -5

echo "== 5/5 Caddy (веб-сервер, сам выпускает HTTPS-сертификат)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi
SITE="${DOMAIN:-:80}"
cat > /etc/caddy/Caddyfile <<CADDY
$SITE {
  encode gzip
  reverse_proxy localhost:3000 {
    flush_interval -1
  }
}
CADDY
systemctl reload caddy || systemctl restart caddy

IP=$(curl -s https://ifconfig.me || hostname -I | awk '{print $1}')
echo
echo "Готово. Откройте: ${DOMAIN:+https://$DOMAIN}${DOMAIN:-http://$IP}"
echo "При первом входе пульт попросит создать учётную запись собственника."
echo "Настройки ИИ: nano $APP_DIR/.env, затем: systemctl restart pult"
