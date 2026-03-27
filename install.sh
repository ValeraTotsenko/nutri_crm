#!/usr/bin/env bash
# ============================================================
#  NutriBot CRM — Полная автоматическая установка
#  Использование: curl -fsSL <url> | sudo bash
# ============================================================

# КРИТИЧНО: закрываем stdin чтобы git/apt/docker не поглощали
# поток скрипта при запуске через curl | bash
exec </dev/null

set -euo pipefail

# ─── Цвета ───────────────────────────────────────────────────
R='\033[0;31m' G='\033[0;32m' Y='\033[1;33m' B='\033[0;34m' C='\033[0;36m' N='\033[0m'
BOLD='\033[1m'

step()   { echo -e "\n${B}${BOLD}━━━ $1 ━━━${N}"; }
ok()     { echo -e "${G}✓${N}  $1"; }
info()   { echo -e "${C}→${N}  $1"; }
warn()   { echo -e "${Y}⚠${N}  $1"; }
err()    { echo -e "${R}✗  ОШИБКА: $1${N}"; exit 1; }
dbg()    { echo -e "  ${Y}[debug]${N} $1"; }

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

INSTALL_DIR="/opt/nutricrm"
REPO_URL="https://github.com/ValeraTotsenko/nutri_crm.git"
ENV_FILE="${INSTALL_DIR}/.env"

# ============================================================
step "Шаг 1/9: Репозиторий"
# ============================================================

if [ ! -d "${INSTALL_DIR}/.git" ]; then
  info "Клонируем репозиторий в ${INSTALL_DIR}..."
  git clone -q "$REPO_URL" "$INSTALL_DIR"
  ok "Репозиторий склонирован"
else
  info "Репозиторий уже существует, обновляем..."
  git -C "$INSTALL_DIR" pull --ff-only -q 2>&1 || true
  ok "Репозиторий обновлён"
fi

# ============================================================
step "Шаг 2/9: Параметры из .env"
# ============================================================

if [ ! -f "$ENV_FILE" ]; then
  cp "${INSTALL_DIR}/.env.example" "$ENV_FILE"
  echo ""
  warn "Файл .env создан из примера. Заполни его и запусти скрипт снова:"
  echo -e "  ${C}nano ${ENV_FILE}${N}"
  echo ""
  echo -e "  Обязательные поля:"
  echo -e "    ${Y}BOT_TOKEN${N}=токен_от_BotFather"
  echo -e "    ${Y}OWNER_TELEGRAM_ID${N}=твой_числовой_id"
  echo -e "    ${Y}WEBAPP_URL${N}=https://имя.duckdns.org"
  echo ""
  exit 0
fi

dbg "Файл .env найден ($(wc -l < "$ENV_FILE") строк)"

# Читаем переменную: сначала из окружения, потом из .env файла
get_env() {
  local key="$1"
  # Если переменная уже задана в окружении — используем её
  local env_val="${!key:-}"
  if [ -n "$env_val" ]; then
    echo "$env_val"
    return
  fi
  # Иначе — читаем из файла, вырезаем всё после первого =, убираем \r и пробелы
  local val
  val=$(grep -m1 "^${key}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- | tr -d '\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' || true)
  echo "$val"
}

BOT_TOKEN=$(get_env "BOT_TOKEN")
OWNER_TELEGRAM_ID=$(get_env "OWNER_TELEGRAM_ID")
WEBAPP_URL=$(get_env "WEBAPP_URL")

dbg "BOT_TOKEN         = '${BOT_TOKEN:0:10}...'"
dbg "OWNER_TELEGRAM_ID = '${OWNER_TELEGRAM_ID}'"
dbg "WEBAPP_URL        = '${WEBAPP_URL}'"

[ -z "$BOT_TOKEN" ]         && err "В ${ENV_FILE} не заполнен BOT_TOKEN"
[ -z "$OWNER_TELEGRAM_ID" ] && err "В ${ENV_FILE} не заполнен OWNER_TELEGRAM_ID"
[ -z "$WEBAPP_URL" ]        && err "В ${ENV_FILE} не заполнен WEBAPP_URL"

DOMAIN="${WEBAPP_URL#https://}"
DOMAIN="${DOMAIN#http://}"
DOMAIN="${DOMAIN%/}"
WEBAPP_URL="https://${DOMAIN}"

ok "BOT_TOKEN:          ${BOT_TOKEN:0:8}..."
ok "OWNER_TELEGRAM_ID:  ${OWNER_TELEGRAM_ID}"
ok "DOMAIN:             ${DOMAIN}"

# Пароль БД — генерируем автоматически (или берём существующий)
EXISTING_PASS=$(get_env "POSTGRES_PASSWORD")
if [ -z "$EXISTING_PASS" ] || echo "$EXISTING_PASS" | grep -q "CHANGE_ME"; then
  # set +o pipefail чтобы SIGPIPE от head не убил скрипт
  set +o pipefail
  DB_PASS=$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 24)
  set -o pipefail
else
  DB_PASS="$EXISTING_PASS"
fi

# ============================================================
step "Шаг 3/9: Системные зависимости"
# ============================================================

info "Обновляем пакеты..."
apt-get update -qq 2>&1 | tail -1

if ! command -v docker &>/dev/null; then
  info "Устанавливаем Docker..."
  curl -fsSL https://get.docker.com | sh -s -- -q
  ok "Docker установлен"
else
  ok "Docker: $(docker --version | cut -d' ' -f3 | tr -d ',')"
fi

if ! docker compose version &>/dev/null 2>&1; then
  info "Устанавливаем Docker Compose plugin..."
  apt-get install -y -qq docker-compose-plugin
fi
ok "Docker Compose: $(docker compose version --short 2>/dev/null || echo 'ok')"

if ! command -v certbot &>/dev/null; then
  info "Устанавливаем certbot..."
  apt-get install -y -qq certbot
fi
ok "Certbot: $(certbot --version 2>&1 | head -1)"

if ! command -v git &>/dev/null; then
  apt-get install -y -qq git
fi
ok "Git: $(git --version)"

# ============================================================
step "Шаг 4/9: SSL сертификат"
# ============================================================

SERVER_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 api.ipify.org 2>/dev/null || echo "unknown")
DOMAIN_IP=$(getent hosts "$DOMAIN" 2>/dev/null | awk '{print $1; exit}' || true)

dbg "IP сервера: ${SERVER_IP}"
dbg "IP домена:  ${DOMAIN_IP:-не определён}"

if [ "$SERVER_IP" != "$DOMAIN_IP" ]; then
  warn "Домен ${DOMAIN} → ${DOMAIN_IP:-?} | Сервер → ${SERVER_IP}"
  warn "DNS может ещё не обновиться. Продолжаем..."
else
  ok "DNS настроен корректно (${SERVER_IP})"
fi

# Освобождаем порт 80 для certbot
fuser -k 80/tcp 2>/dev/null || true
docker compose -f "${INSTALL_DIR}/docker-compose.yml" down 2>/dev/null || true
sleep 1

if [ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  info "Получаем SSL сертификат для ${DOMAIN}..."
  certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --register-unsafely-without-email \
    -d "$DOMAIN" \
    2>&1
  ok "SSL сертификат получен"
else
  ok "SSL сертификат уже существует"
fi

# ============================================================
step "Шаг 5/9: Конфигурация .env"
# ============================================================

add_if_missing() {
  local key="$1" val="$2"
  if ! grep -q "^${key}=" "$ENV_FILE"; then
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

# Заменяем CHANGE_ME на сгенерированный пароль
if grep -q "CHANGE_ME" "$ENV_FILE" 2>/dev/null; then
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

ok ".env дополнен"

# SSL сертификаты → папка nginx
info "Копируем SSL сертификаты в nginx/certs..."
mkdir -p "${INSTALL_DIR}/nginx/certs"
cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" "${INSTALL_DIR}/nginx/certs/"
cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem"   "${INSTALL_DIR}/nginx/certs/"
ok "Сертификаты скопированы"

# nginx.conf с HTTPS
cat > "${INSTALL_DIR}/nginx/nginx.conf" << NGINX
events { worker_connections 1024; }

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    keepalive_timeout 65;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    limit_req_zone \$binary_remote_addr zone=api:10m rate=30r/s;

    upstream backend { server backend:3000; }

    server {
        listen 80;
        server_name _;
        return 301 https://\$host\$request_uri;
    }

    server {
        listen 443 ssl;
        server_name _;

        ssl_certificate     /etc/nginx/certs/fullchain.pem;
        ssl_certificate_key /etc/nginx/certs/privkey.pem;
        ssl_protocols       TLSv1.2 TLSv1.3;

        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Strict-Transport-Security "max-age=31536000" always;

        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-Proto https;
        }

        location /bot/ {
            proxy_pass http://backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
        }

        location /health {
            proxy_pass http://backend;
        }

        location / {
            root /usr/share/nginx/html;
            index index.html;
            try_files \$uri \$uri/ /index.html;
        }
    }
}
NGINX
ok "nginx.conf сгенерирован"

# ============================================================
step "Шаг 6/9: Сборка Frontend"
# ============================================================

if command -v node &>/dev/null; then
  info "Собираем frontend локально (node $(node -v))..."
  cd "${INSTALL_DIR}/frontend"
  npm ci --silent
  VITE_API_URL=/api npm run build
  cd "${INSTALL_DIR}"
  ok "Frontend собран в dist/"
else
  info "Node.js не найден — собираем через Docker..."
  docker run --rm \
    -v "${INSTALL_DIR}/frontend:/app" \
    -w /app \
    node:20-alpine \
    sh -c "npm ci --silent && VITE_API_URL=/api npm run build"
  ok "Frontend собран через Docker"
fi

# ============================================================
step "Шаг 7/9: Запуск контейнеров"
# ============================================================

cd "${INSTALL_DIR}"

info "Собираем Docker образы (это займёт несколько минут)..."
docker compose build --no-cache 2>&1 | grep -E "^(Step|#|ERROR|WARN)" || true
ok "Образы собраны"

info "Запускаем контейнеры..."
docker compose up -d
ok "Контейнеры запущены"

info "Ожидаем готовности PostgreSQL..."
RETRIES=30
until docker compose exec -T postgres pg_isready -U nutricrm -d nutricrm > /dev/null 2>&1; do
  RETRIES=$((RETRIES-1))
  [ $RETRIES -eq 0 ] && err "PostgreSQL не запустился за 60с. Проверь: docker compose logs postgres"
  printf "."
  sleep 2
done
echo ""
ok "PostgreSQL готов"

info "Применяем миграции БД..."
docker compose exec -T backend node src/db/migrate.js
ok "Миграции применены"

# ============================================================
step "Шаг 8/9: Telegram Webhook"
# ============================================================

info "Ждём запуска backend..."
sleep 5

WEBHOOK_URL="${WEBAPP_URL}/bot/webhook"
RESPONSE=$(curl -s --max-time 10 "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${WEBHOOK_URL}" || true)
dbg "Ответ Telegram: ${RESPONSE}"

if echo "$RESPONSE" | grep -q '"ok":true'; then
  ok "Webhook зарегистрирован: ${WEBHOOK_URL}"
else
  warn "Не удалось зарегистрировать webhook автоматически."
  warn "Сделай вручную: curl 'https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${WEBHOOK_URL}'"
fi

# ============================================================
step "Шаг 9/9: Cron и проверка"
# ============================================================

CRON_BACKUP="0 3 * * * cd ${INSTALL_DIR} && ./scripts/backup.sh >> /var/log/nutricrm-backup.log 2>&1"
CRON_SSL="0 4 1 */2 * certbot renew --quiet && cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ${INSTALL_DIR}/nginx/certs/ && cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem ${INSTALL_DIR}/nginx/certs/ && docker compose -f ${INSTALL_DIR}/docker-compose.yml restart nginx"

(crontab -l 2>/dev/null | grep -v "nutricrm-backup" | grep -v "certbot renew"; echo "$CRON_BACKUP"; echo "$CRON_SSL") | crontab -
ok "Cron: бэкап в 3:00, обновление SSL каждые 2 месяца"

info "Проверяем healthcheck..."
sleep 5
HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" "${WEBAPP_URL}/health" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  ok "Healthcheck: ${HTTP_CODE} OK"
else
  warn "Healthcheck: ${HTTP_CODE} (сервер мог ещё не запуститься)"
fi

echo ""
docker compose ps

# ============================================================
echo ""
echo -e "${G}${BOLD}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║          ✓  NutriBot CRM успешно установлен!            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${N}"
echo -e "  Mini App:   ${C}${WEBAPP_URL}${N}"
echo -e "  Webhook:    ${C}${WEBAPP_URL}/bot/webhook${N}"
echo -e "  Пароль БД:  ${R}${DB_PASS}${N}  (сохрани!)"
echo ""
echo -e "${BOLD}Следующий шаг:${N}"
echo -e "  @BotFather → /setmenubutton → выбери бота"
echo -e "  → Menu Button URL: ${C}${WEBAPP_URL}${N}"
echo ""
echo -e "${BOLD}Управление (из ${INSTALL_DIR}):${N}"
echo -e "  make logs     — логи"
echo -e "  make backup   — бэкап БД"
echo -e "  make down/up  — стоп/старт"
echo ""
