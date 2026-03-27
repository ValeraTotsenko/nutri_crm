#!/usr/bin/env bash
# =============================================================
#  NutriBot CRM — установка на чистый VPS
#  Запуск:
#    BOT_TOKEN="..." OWNER_TELEGRAM_ID="..." WEBAPP_URL="https://..." bash install.sh
# =============================================================

# Закрываем stdin: git/apt/docker не должны читать поток скрипта
exec </dev/null

set -euo pipefail

# ── Цвета ─────────────────────────────────────────────────────
R='\033[0;31m' G='\033[0;32m' Y='\033[1;33m' B='\033[0;34m' C='\033[0;36m' N='\033[0m'
BOLD='\033[1m'

step() { echo -e "\n${B}${BOLD}━━━ $1 ━━━${N}"; }
ok()   { echo -e "${G}✓${N}  $1"; }
info() { echo -e "${C}→${N}  $1"; }
warn() { echo -e "${Y}⚠${N}  $1"; }
err()  { echo -e "\n${R}${BOLD}✗  ОШИБКА: $1${N}\n"; exit 1; }

echo -e "${G}${BOLD}"
cat << 'LOGO'
  _   _       _        _ ____        _    ____ ____  __  __
 | \ | |_   _| |_ _ __(_)  _ \  ___ | |_ / ___|  _ \|  \/  |
 |  \| | | | | __| '__| | |_) |/ _ \| __| |   | |_) | |\/| |
 | |\  | |_| | |_| |  | |  _ <| (_) | |_| |___|  _ <| |  | |
 |_| \_|\__,_|\__|_|  |_|_| \_\\___/ \__|\____|_| \_\_|  |_|
LOGO
echo -e "${N}  ${BOLD}Автоматическая установка на VPS${N}"
echo -e "  ${C}github.com/ValeraTotsenko/nutri_crm${N}\n"

[ "$EUID" -ne 0 ] && err "Нужны права root. Запусти: sudo -E bash install.sh"

INSTALL_DIR="/opt/nutricrm"
REPO_URL="https://github.com/ValeraTotsenko/nutri_crm.git"

# =============================================================
step "Шаг 1/8: Базовые зависимости"
# =============================================================

info "Обновляем пакеты..."
apt-get update -qq

info "Устанавливаем curl, git, psmisc..."
apt-get install -y -qq curl git ca-certificates psmisc

ok "Базовые инструменты готовы"

# =============================================================
step "Шаг 2/8: Docker"
# =============================================================

if ! command -v docker &>/dev/null; then
  info "Устанавливаем Docker..."
  curl -fsSL https://get.docker.com | sh -s -- -q
  ok "Docker установлен"
else
  ok "Docker $(docker --version | grep -oP '\d+\.\d+\.\d+')"
fi

if ! docker compose version &>/dev/null 2>&1; then
  info "Устанавливаем Docker Compose plugin..."
  apt-get install -y -qq docker-compose-plugin
fi
ok "Docker Compose $(docker compose version --short 2>/dev/null || echo 'ok')"

# =============================================================
step "Шаг 3/8: Репозиторий"
# =============================================================

if [ ! -d "${INSTALL_DIR}/.git" ]; then
  info "Клонируем в ${INSTALL_DIR}..."
  git clone -q "$REPO_URL" "$INSTALL_DIR"
  ok "Клонировано"
else
  info "Обновляем существующий репозиторий..."
  git -C "$INSTALL_DIR" fetch -q origin
  git -C "$INSTALL_DIR" reset -q --hard origin/master
  ok "Обновлено до последней версии"
fi

# =============================================================
step "Шаг 4/8: Параметры"
# =============================================================

# Функция: читаем из окружения, потом из .env файла
ENV_FILE="${INSTALL_DIR}/.env"

get_param() {
  local key="$1"
  # 1. Из переменной окружения (переданной через env)
  local from_env="${!key:-}"
  [ -n "$from_env" ] && { echo "$from_env"; return; }
  # 2. Из файла .env
  if [ -f "$ENV_FILE" ]; then
    local from_file
    from_file=$(grep -m1 "^${key}=" "$ENV_FILE" 2>/dev/null \
      | cut -d'=' -f2- | tr -d '\r\n' \
      | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' || true)
    [ -n "$from_file" ] && { echo "$from_file"; return; }
  fi
  echo ""
}

BOT_TOKEN=$(get_param "BOT_TOKEN")
OWNER_TELEGRAM_ID=$(get_param "OWNER_TELEGRAM_ID")
WEBAPP_URL=$(get_param "WEBAPP_URL")

[ -z "$BOT_TOKEN" ]         && err "Не задан BOT_TOKEN\n  Запусти: BOT_TOKEN=xxx OWNER_TELEGRAM_ID=xxx WEBAPP_URL=https://xxx sudo -E bash install.sh"
[ -z "$OWNER_TELEGRAM_ID" ] && err "Не задан OWNER_TELEGRAM_ID"
[ -z "$WEBAPP_URL" ]        && err "Не задан WEBAPP_URL"

# Нормализуем домен
DOMAIN="${WEBAPP_URL#https://}"
DOMAIN="${DOMAIN#http://}"
DOMAIN="${DOMAIN%/}"
WEBAPP_URL="https://${DOMAIN}"

ok "BOT_TOKEN:          ${BOT_TOKEN:0:8}..."
ok "OWNER_TELEGRAM_ID:  ${OWNER_TELEGRAM_ID}"
ok "DOMAIN:             ${DOMAIN}"

# =============================================================
step "Шаг 5/8: SSL сертификат"
# =============================================================

# Проверяем DNS
SERVER_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null \
  || curl -s --max-time 5 api.ipify.org 2>/dev/null \
  || echo "unknown")
DOMAIN_IP=$(getent hosts "$DOMAIN" 2>/dev/null | awk '{print $1; exit}' || echo "")

info "IP сервера: ${SERVER_IP} | IP домена: ${DOMAIN_IP:-не определён}"

if [ -n "$DOMAIN_IP" ] && [ "$SERVER_IP" != "$DOMAIN_IP" ]; then
  warn "Домен ещё не указывает на этот сервер — SSL может не выдаться"
  warn "Убедись что A-запись: ${DOMAIN} → ${SERVER_IP}"
fi

if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  ok "SSL сертификат уже существует"
else
  # Устанавливаем certbot
  if ! command -v certbot &>/dev/null; then
    info "Устанавливаем certbot..."
    apt-get install -y -qq certbot
  fi

  # Освобождаем порт 80
  info "Освобождаем порт 80..."
  kill "$(lsof -t -i:80 2>/dev/null)" 2>/dev/null || true
  docker compose -f "${INSTALL_DIR}/docker-compose.yml" down 2>/dev/null || true
  sleep 2

  info "Получаем SSL сертификат для ${DOMAIN}..."
  certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --register-unsafely-without-email \
    -d "$DOMAIN"
  ok "SSL сертификат получен"
fi

# Копируем сертификаты в папку nginx
mkdir -p "${INSTALL_DIR}/nginx/certs"
cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" "${INSTALL_DIR}/nginx/certs/"
cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem"   "${INSTALL_DIR}/nginx/certs/"
ok "Сертификаты скопированы → nginx/certs/"

# =============================================================
step "Шаг 6/8: Конфигурация"
# =============================================================

# Генерируем пароль БД (или берём существующий)
EXISTING_PASS=$(get_param "POSTGRES_PASSWORD")
if [ -z "$EXISTING_PASS" ] || echo "$EXISTING_PASS" | grep -q "CHANGE_ME"; then
  set +o pipefail
  DB_PASS=$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 24)
  set -o pipefail
else
  DB_PASS="$EXISTING_PASS"
fi

# Пишем полный .env (перезаписываем — источник правды)
cat > "$ENV_FILE" << EOF
# =============================================
# NutriBot CRM — $(date '+%Y-%m-%d %H:%M')
# =============================================

# Telegram
BOT_TOKEN=${BOT_TOKEN}
OWNER_TELEGRAM_ID=${OWNER_TELEGRAM_ID}
WEBAPP_URL=${WEBAPP_URL}

# База данных
POSTGRES_DB=nutricrm
POSTGRES_USER=nutricrm
POSTGRES_PASSWORD=${DB_PASS}
DATABASE_URL=postgresql://nutricrm:${DB_PASS}@postgres:5432/nutricrm

# Backend
PORT=3000
NODE_ENV=production
TZ=Europe/Kyiv

# Уведомления
NOTIFICATIONS_HOUR=10
NOTIFICATIONS_TZ=Europe/Kyiv

# Backup
BACKUP_KEEP_DAYS=30
BACKUP_SSH_USER=root
BACKUP_SSH_HOST=${SERVER_IP}
BACKUP_REMOTE_PATH=/opt/nutricrm/backups
EOF

ok ".env записан"

# Генерируем nginx.conf с HTTPS
cat > "${INSTALL_DIR}/nginx/nginx.conf" << 'NGINX_EOF'
events { worker_connections 1024; }

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    keepalive_timeout 65;
    client_max_body_size 10m;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

    upstream backend { server backend:3000; }

    # HTTP → HTTPS
    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }

    # HTTPS
    server {
        listen 443 ssl;
        server_name _;

        ssl_certificate     /etc/nginx/certs/fullchain.pem;
        ssl_certificate_key /etc/nginx/certs/privkey.pem;
        ssl_protocols       TLSv1.2 TLSv1.3;
        ssl_ciphers         HIGH:!aNULL:!MD5;

        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Strict-Transport-Security "max-age=31536000" always;

        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }

        location /bot/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        location /health {
            proxy_pass http://backend;
        }

        location / {
            root /usr/share/nginx/html;
            index index.html;
            try_files $uri $uri/ /index.html;
        }
    }
}
NGINX_EOF

ok "nginx.conf сгенерирован"

# =============================================================
step "Шаг 7/8: Сборка и запуск"
# =============================================================

# Собираем frontend
info "Собираем frontend..."
if command -v node &>/dev/null; then
  cd "${INSTALL_DIR}/frontend"
  npm ci --silent
  VITE_API_URL=/api npm run build --silent
  cd "${INSTALL_DIR}"
else
  docker run --rm \
    -v "${INSTALL_DIR}/frontend:/app" \
    -w /app \
    node:20-alpine \
    sh -c "npm ci --silent && VITE_API_URL=/api npm run build --silent"
fi
ok "Frontend собран → frontend/dist/"

cd "${INSTALL_DIR}"

info "Собираем Docker образы..."
docker compose build --no-cache -q
ok "Образы готовы"

info "Запускаем контейнеры..."
docker compose up -d
ok "Контейнеры запущены"

# Ждём PostgreSQL
info "Ожидаем PostgreSQL..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U nutricrm -d nutricrm > /dev/null 2>&1; then
    echo ""
    ok "PostgreSQL готов"
    break
  fi
  [ "$i" -eq 30 ] && err "PostgreSQL не запустился за 60с.\nПроверь: docker compose logs postgres"
  printf "."
  sleep 2
done

info "Применяем миграции..."
docker compose exec -T backend node src/db/migrate.js
ok "Миграции применены"

# =============================================================
step "Шаг 8/8: Telegram webhook и автозапуск"
# =============================================================

info "Регистрируем Telegram webhook..."
sleep 5
WEBHOOK_URL="${WEBAPP_URL}/bot/webhook"
RESPONSE=$(curl -s --max-time 15 \
  "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${WEBHOOK_URL}" || true)

if echo "$RESPONSE" | grep -q '"ok":true'; then
  ok "Webhook: ${WEBHOOK_URL}"
else
  warn "Не удалось зарегистрировать webhook автоматически"
  warn "Выполни вручную после запуска:"
  warn "  curl 'https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${WEBHOOK_URL}'"
fi

# Cron: бэкап и продление SSL
CRON_BACKUP="0 3 * * * cd ${INSTALL_DIR} && bash scripts/backup.sh >> /var/log/nutricrm-backup.log 2>&1"
CRON_SSL="0 4 1 */2 * certbot renew -q && cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ${INSTALL_DIR}/nginx/certs/ && cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem ${INSTALL_DIR}/nginx/certs/ && docker compose -f ${INSTALL_DIR}/docker-compose.yml restart nginx"

(crontab -l 2>/dev/null \
  | grep -v "nutricrm" \
  | grep -v "certbot renew"
  echo "$CRON_BACKUP"
  echo "$CRON_SSL"
) | crontab -

ok "Cron настроен (бэкап 3:00, SSL обновление раз в 2 месяца)"

# Healthcheck
info "Проверяем доступность..."
sleep 5
HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" "${WEBAPP_URL}/health" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  ok "Healthcheck: 200 OK"
else
  warn "Healthcheck вернул ${HTTP_CODE} — подождите 10-20 секунд и проверьте снова"
fi

echo ""
docker compose ps

# =============================================================
echo ""
echo -e "${G}${BOLD}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║       ✓  NutriBot CRM успешно установлен!          ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${N}"
echo -e "  Mini App:  ${C}${WEBAPP_URL}${N}"
echo -e "  Health:    ${C}${WEBAPP_URL}/health${N}"
echo -e "  Webhook:   ${C}${WEBAPP_URL}/bot/webhook${N}"
echo ""
echo -e "${Y}${BOLD}  Пароль БД (сохрани!): ${R}${DB_PASS}${N}"
echo ""
echo -e "${BOLD}  Последний шаг — зарегистрируй Mini App:${N}"
echo -e "  1. Открой @BotFather в Telegram"
echo -e "  2. /setmenubutton → выбери бота"
echo -e "  3. Menu Button URL: ${C}${WEBAPP_URL}${N}"
echo ""
echo -e "${BOLD}  Управление (cd ${INSTALL_DIR}):${N}"
echo -e "  make logs    — логи всех сервисов"
echo -e "  make backup  — ручной бэкап БД"
echo -e "  make down    — остановить"
echo -e "  make up      — запустить"
echo ""
