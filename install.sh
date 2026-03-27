#!/usr/bin/env bash
# ============================================================
#  NutriBot CRM — Полная автоматическая установка
#  Использование: bash install.sh
# ============================================================
set -euo pipefail

# ─── Цвета ───────────────────────────────────────────────────
R='\033[0;31m' G='\033[0;32m' Y='\033[1;33m' B='\033[0;34m' C='\033[0;36m' N='\033[0m'
BOLD='\033[1m'

header() { echo -e "\n${B}${BOLD}━━━ $1 ━━━${N}\n"; }
ok()     { echo -e "${G}✓${N}  $1"; }
info()   { echo -e "${C}→${N}  $1"; }
warn()   { echo -e "${Y}⚠${N}  $1"; }
err()    { echo -e "${R}✗${N}  $1"; exit 1; }

clear
echo -e "${G}${BOLD}"
cat << 'LOGO'
  _   _       _        _ ____        _    ____ ____  __  __
 | \ | |_   _| |_ _ __(_)  _ \  ___ | |_ / ___|  _ \|  \/  |
 |  \| | | | | __| '__| | |_) |/ _ \| __| |   | |_) | |\/| |
 | |\  | |_| | |_| |  | |  _ <| (_) | |_| |___|  _ <| |  | |
 |_| \_|\__,_|\__|_|  |_|_| \_\\___/ \__|\____|_| \_\_|  |_|
LOGO
echo -e "${N}"
echo -e "${BOLD}  Автоматическая установка на VPS${N}"
echo -e "  ${C}github.com/ValeraTotsenko/nutri_crm${N}\n"

# ─── Проверка root ────────────────────────────────────────────
[ "$EUID" -ne 0 ] && err "Запусти скрипт от root: sudo bash install.sh"

# ─── Определение директории ───────────────────────────────────
INSTALL_DIR="/opt/nutricrm"
REPO_URL="https://github.com/ValeraTotsenko/nutri_crm.git"

# ============================================================
header "Шаг 1: Параметры"
# ============================================================

ENV_FILE="${INSTALL_DIR}/.env"

# ── Клонируем репо заранее, чтобы .env был доступен ──────
if [ ! -d "${INSTALL_DIR}/.git" ]; then
  info "Клонируем репозиторий в ${INSTALL_DIR}..."
  git clone -q "$REPO_URL" "$INSTALL_DIR"
  ok "Репозиторий склонирован"
else
  ok "Репозиторий уже существует, обновляем..."
  git -C "$INSTALL_DIR" pull -q
fi

# ── Создаём .env из примера если его нет ─────────────────
if [ ! -f "$ENV_FILE" ]; then
  cp "${INSTALL_DIR}/.env.example" "$ENV_FILE"
  warn "Создан ${ENV_FILE} из примера — заполни его и перезапусти скрипт"
  echo ""
  echo -e "  Открой файл:  ${C}nano ${ENV_FILE}${N}"
  echo -e "  Заполни:"
  echo -e "    ${Y}BOT_TOKEN${N}=токен_от_BotFather"
  echo -e "    ${Y}OWNER_TELEGRAM_ID${N}=твой_числовой_id"
  echo -e "    ${Y}WEBAPP_URL${N}=https://имя.duckdns.org"
  echo ""
  echo -e "  После сохранения запусти снова:"
  echo -e "  ${C}curl -fsSL https://raw.githubusercontent.com/ValeraTotsenko/nutri_crm/master/install.sh | sudo bash${N}"
  exit 0
fi

# ── Читаем параметры из .env ──────────────────────────────
ok "Читаем конфиг из ${ENV_FILE}"
get_env() { grep "^${1}=" "$ENV_FILE" | head -1 | cut -d'=' -f2- | tr -d '\r\n'; }

BOT_TOKEN=$(get_env "BOT_TOKEN")
OWNER_TELEGRAM_ID=$(get_env "OWNER_TELEGRAM_ID")
WEBAPP_URL=$(get_env "WEBAPP_URL")

[ -z "$BOT_TOKEN" ]         && err "В ${ENV_FILE} не заполнен BOT_TOKEN"
[ -z "$OWNER_TELEGRAM_ID" ] && err "В ${ENV_FILE} не заполнен OWNER_TELEGRAM_ID"
[ -z "$WEBAPP_URL" ]        && err "В ${ENV_FILE} не заполнен WEBAPP_URL"

DOMAIN="${WEBAPP_URL#https://}"
DOMAIN="${DOMAIN#http://}"
DOMAIN="${DOMAIN%/}"

info "BOT_TOKEN:          ${BOT_TOKEN:0:8}..."
info "OWNER_TELEGRAM_ID:  ${OWNER_TELEGRAM_ID}"
info "DOMAIN:             ${DOMAIN}"

DOMAIN="${DOMAIN#https://}"
DOMAIN="${DOMAIN#http://}"
DOMAIN="${DOMAIN%/}"
WEBAPP_URL="https://${DOMAIN}"

# Пароль БД — генерируем автоматически
DB_PASS=$(tr -dc 'A-Za-z0-9!@#$%^&*' < /dev/urandom | head -c 24)

# Подтверждение
echo ""
echo -e "┌─────────────────────────────────────────┐"
echo -e "│  ${BOLD}Параметры установки${N}                     │"
echo -e "├─────────────────────────────────────────┤"
echo -e "│  Домен:    ${C}${WEBAPP_URL}${N}"
echo -e "│  Bot ID:   ${OWNER_TELEGRAM_ID}"
echo -e "│  Токен:    ${BOT_TOKEN:0:8}..."
echo -e "│  Папка:    ${INSTALL_DIR}"
echo -e "└─────────────────────────────────────────┘"
echo ""
ok "Параметры приняты — начинаем установку..."

# ============================================================
header "Шаг 2: Системные зависимости"
# ============================================================

info "Обновляем пакеты..."
apt-get update -qq

# Docker
if ! command -v docker &>/dev/null; then
  info "Устанавливаем Docker..."
  curl -fsSL https://get.docker.com | sh -s -- -q
  ok "Docker установлен"
else
  ok "Docker уже установлен ($(docker --version | cut -d' ' -f3 | tr -d ','))"
fi

# Docker Compose
if ! docker compose version &>/dev/null 2>&1; then
  info "Устанавливаем Docker Compose plugin..."
  apt-get install -y -qq docker-compose-plugin
fi
ok "Docker Compose готов"

# certbot
if ! command -v certbot &>/dev/null; then
  info "Устанавливаем certbot..."
  apt-get install -y -qq certbot
fi
ok "Certbot готов"

# git
if ! command -v git &>/dev/null; then
  apt-get install -y -qq git
fi
ok "Git готов"

# curl
apt-get install -y -qq curl > /dev/null 2>&1
ok "Curl готов"

# ============================================================
header "Шаг 3: Получение SSL сертификата"
# ============================================================

info "Проверяем что ${DOMAIN} указывает на этот сервер..."
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s api.ipify.org 2>/dev/null || echo "unknown")
DOMAIN_IP=$(getent hosts "$DOMAIN" | awk '{print $1}' || true)

if [ "$SERVER_IP" != "$DOMAIN_IP" ] && [ -n "$DOMAIN_IP" ]; then
  warn "IP сервера: ${SERVER_IP}"
  warn "IP домена:  ${DOMAIN_IP}"
  warn "Домен не указывает на этот сервер. DNS мог ещё не обновиться (до 24ч)."
  warn "Продолжаем — убедись что A-запись настроена: ${DOMAIN} → ${SERVER_IP}"
elif [ -z "$DOMAIN_IP" ]; then
  warn "Не удалось проверить DNS. Убедись что A-запись настроена: ${DOMAIN} → ${SERVER_IP}"
else
  ok "DNS настроен корректно (${SERVER_IP})"
fi

# Останавливаем всё что занимает порт 80
info "Освобождаем порт 80 для certbot..."
fuser -k 80/tcp 2>/dev/null || true
docker compose -f "${INSTALL_DIR}/docker-compose.yml" down 2>/dev/null || true

# Получаем сертификат
if [ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  info "Получаем SSL сертификат для ${DOMAIN}..."
  certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --register-unsafely-without-email \
    -d "$DOMAIN"
  ok "SSL сертификат получен"
else
  ok "SSL сертификат уже существует"
fi

# ============================================================
header "Шаг 4: Установка проекта"
# ============================================================

cd "$INSTALL_DIR"
ok "Репозиторий готов"

# ============================================================
header "Шаг 5: Конфигурация"
# ============================================================

# Дописываем в .env недостающие поля (пароль БД, defaults)
info "Дополняем .env нужными полями..."

# Добавляем только если строк ещё нет
add_if_missing() {
  local key="$1" val="$2"
  grep -q "^${key}=" "$ENV_FILE" || echo "${key}=${val}" >> "$ENV_FILE"
}

# Заменяем CHANGE_ME пароль на сгенерированный
if grep -q "CHANGE_ME" "$ENV_FILE"; then
  sed -i "s/CHANGE_ME_STRONG_PASSWORD_HERE/${DB_PASS}/g" "$ENV_FILE"
fi

add_if_missing "POSTGRES_DB"        "nutricrm"
add_if_missing "POSTGRES_USER"      "nutricrm"
add_if_missing "POSTGRES_PASSWORD"  "${DB_PASS}"
add_if_missing "DATABASE_URL"       "postgresql://nutricrm:${DB_PASS}@postgres:5432/nutricrm"
add_if_missing "PORT"               "3000"
add_if_missing "NODE_ENV"           "production"
add_if_missing "TZ"                 "Europe/Kyiv"
add_if_missing "NOTIFICATIONS_HOUR" "10"
add_if_missing "NOTIFICATIONS_TZ"   "Europe/Kyiv"
add_if_missing "BACKUP_KEEP_DAYS"   "30"
add_if_missing "BACKUP_SSH_USER"    "root"
add_if_missing "BACKUP_SSH_HOST"    "${SERVER_IP}"
add_if_missing "BACKUP_REMOTE_PATH" "/opt/nutricrm/backups"

ok ".env готов"

# Сертификаты → папка nginx
info "Копируем SSL сертификаты..."
mkdir -p "${INSTALL_DIR}/nginx/certs"
cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" "${INSTALL_DIR}/nginx/certs/"
cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem"   "${INSTALL_DIR}/nginx/certs/"
ok "Сертификаты скопированы"

# nginx.conf с HTTPS
info "Генерируем nginx.conf с HTTPS..."
cat > "${INSTALL_DIR}/nginx/nginx.conf" << 'NGINX'
events { worker_connections 1024; }

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    keepalive_timeout 65;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

    upstream backend { server backend:3000; }

    # HTTP → HTTPS редирект
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
            proxy_set_header X-Forwarded-Proto $scheme;
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
NGINX
ok "nginx.conf с HTTPS сгенерирован"

# ============================================================
header "Шаг 6: Сборка Frontend"
# ============================================================

if command -v node &>/dev/null; then
  info "Собираем frontend локально..."
  cd "${INSTALL_DIR}/frontend"
  npm ci --silent
  VITE_API_URL=/api npm run build
  cd "${INSTALL_DIR}"
  ok "Frontend собран (dist/)"
else
  info "Node.js не найден на сервере, frontend соберётся внутри Docker..."
  # Временный docker build только для frontend
  docker run --rm \
    -v "${INSTALL_DIR}/frontend:/app" \
    -w /app \
    node:20-alpine \
    sh -c "npm ci --silent && VITE_API_URL=/api npm run build"
  ok "Frontend собран через Docker"
fi

# ============================================================
header "Шаг 7: Запуск контейнеров"
# ============================================================

cd "${INSTALL_DIR}"
info "Собираем Docker образы..."
docker compose build --no-cache -q
ok "Образы собраны"

info "Запускаем контейнеры..."
docker compose up -d
ok "Контейнеры запущены"

# Ждём postgres
info "Ожидаем готовности PostgreSQL..."
source .env
RETRIES=30
until docker compose exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
  printf "."
  RETRIES=$((RETRIES-1))
  sleep 2
done
echo ""
[ $RETRIES -eq 0 ] && err "PostgreSQL не запустился за 60 секунд. Проверь: docker compose logs postgres"
ok "PostgreSQL готов"

# Миграции
info "Применяем миграции БД..."
docker compose exec -T backend node src/db/migrate.js
ok "Миграции применены"

# ============================================================
header "Шаг 8: Настройка Telegram Webhook"
# ============================================================

info "Регистрируем Bot Webhook..."
sleep 3  # ждём пока backend полностью стартует

WEBHOOK_URL="${WEBAPP_URL}/bot/webhook"
RESPONSE=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${WEBHOOK_URL}")
OK_STATUS=$(echo "$RESPONSE" | grep -o '"ok":true' || true)

if [ -n "$OK_STATUS" ]; then
  ok "Webhook зарегистрирован: ${WEBHOOK_URL}"
else
  warn "Не удалось зарегистрировать webhook автоматически."
  warn "Сделай вручную после запуска:"
  warn "  curl https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${WEBHOOK_URL}"
fi

# ============================================================
header "Шаг 9: Автоматизация (cron)"
# ============================================================

# Автобэкап в 3:00 каждый день
CRON_BACKUP="0 3 * * * cd ${INSTALL_DIR} && ./scripts/backup.sh >> /var/log/nutricrm-backup.log 2>&1"
# Обновление SSL каждые 60 дней
CRON_SSL="0 4 1 */2 * certbot renew --quiet && cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ${INSTALL_DIR}/nginx/certs/ && cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem ${INSTALL_DIR}/nginx/certs/ && docker compose -f ${INSTALL_DIR}/docker-compose.yml restart nginx"

# Добавляем в crontab если ещё нет
(crontab -l 2>/dev/null | grep -v "nutricrm-backup" | grep -v "certbot renew"; echo "$CRON_BACKUP"; echo "$CRON_SSL") | crontab -
ok "Cron настроен:"
ok "  • Бэкап БД — каждый день в 3:00"
ok "  • Обновление SSL — каждые 2 месяца"

# ============================================================
header "Шаг 10: Проверка"
# ============================================================

info "Проверяем healthcheck..."
sleep 5
HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" "${WEBAPP_URL}/health" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
  ok "Healthcheck: ${HTTP_CODE} ✓"
else
  warn "Healthcheck вернул: ${HTTP_CODE} (сервер мог ещё не запуститься)"
fi

# Статус контейнеров
echo ""
docker compose ps

# ============================================================
echo ""
echo -e "${G}${BOLD}"
cat << 'DONE'
╔══════════════════════════════════════════════════════════╗
║            ✓  NutriBot CRM установлен!                  ║
╚══════════════════════════════════════════════════════════╝
DONE
echo -e "${N}"

echo -e "${BOLD}Твои данные:${N}"
echo -e "  🌐 Mini App URL:  ${C}${WEBAPP_URL}${N}"
echo -e "  🤖 Webhook:       ${C}${WEBAPP_URL}/bot/webhook${N}"
echo -e "  🔑 Telegram ID:   ${OWNER_TELEGRAM_ID}"
echo ""
echo -e "${BOLD}Следующие шаги:${N}"
echo -e "  ${Y}1.${N} Открой @BotFather → /setmenubutton → выбери бота"
echo -e "     → Menu Button → укажи URL: ${C}${WEBAPP_URL}${N}"
echo -e "  ${Y}2.${N} Напиши своему боту /start"
echo -e "  ${Y}3.${N} Должна появиться кнопка ${C}📱 Открыть CRM${N}"
echo ""
echo -e "${BOLD}Управление:${N}"
echo -e "  cd ${INSTALL_DIR}"
echo -e "  make logs     — просмотр логов"
echo -e "  make backup   — бэкап БД"
echo -e "  make down     — остановить"
echo -e "  make up       — запустить"
echo ""
echo -e "${BOLD}Пароль БД (сохрани себе!):${N}"
echo -e "  ${R}${DB_PASS}${N}"
echo -e "  (также хранится в ${INSTALL_DIR}/.env)"
echo ""
