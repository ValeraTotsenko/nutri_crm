#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}"
echo "╔════════════════════════════════════╗"
echo "║       NutriBot CRM Setup           ║"
echo "╚════════════════════════════════════╝"
echo -e "${NC}"

# 1. Проверка .env
if [ ! -f .env ]; then
  echo -e "${RED}Ошибка: файл .env не найден!${NC}"
  echo "Скопируй .env.example в .env и заполни значения:"
  echo "  cp .env.example .env && nano .env"
  exit 1
fi

# 2. Проверка обязательных переменных
source .env
REQUIRED_VARS="POSTGRES_PASSWORD BOT_TOKEN OWNER_TELEGRAM_ID WEBAPP_URL"
for var in $REQUIRED_VARS; do
  if [ -z "${!var:-}" ]; then
    echo -e "${RED}Ошибка: переменная $var не задана в .env${NC}"
    exit 1
  fi
done

# 3. Проверка docker
if ! command -v docker &> /dev/null; then
  echo -e "${RED}Docker не установлен. Установи Docker: https://docs.docker.com/get-docker/${NC}"
  exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
  echo -e "${RED}docker-compose не установлен.${NC}"
  exit 1
fi

# Определяем команду compose
COMPOSE_CMD="docker compose"
command -v docker-compose &> /dev/null && COMPOSE_CMD="docker-compose"

# 4. Сборка frontend (если есть исходники)
if [ -f frontend/package.json ] && [ ! -d frontend/dist ]; then
  echo -e "${YELLOW}Собираем frontend...${NC}"
  cd frontend && npm ci && npm run build && cd ..
fi

# 5. Build и запуск
echo -e "${YELLOW}Собираем и запускаем контейнеры...${NC}"
$COMPOSE_CMD build --no-cache
$COMPOSE_CMD up -d

# 6. Ждём postgres
echo -e "${YELLOW}Ожидаем готовность PostgreSQL...${NC}"
RETRIES=30
until $COMPOSE_CMD exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
  echo "Ждём... ($RETRIES)"
  RETRIES=$((RETRIES-1))
  sleep 2
done

if [ $RETRIES -eq 0 ]; then
  echo -e "${RED}PostgreSQL не запустился за 60 секунд${NC}"
  $COMPOSE_CMD logs postgres
  exit 1
fi

# 7. Запуск миграций
echo -e "${YELLOW}Запускаем миграции БД...${NC}"
$COMPOSE_CMD exec -T backend node src/db/migrate.js

# 8. Healthcheck
echo -e "${YELLOW}Проверяем healthcheck...${NC}"
sleep 3
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Backend доступен${NC}"
else
  echo -e "${YELLOW}⚠ Healthcheck вернул $HTTP_CODE (может потребоваться время)${NC}"
fi

echo -e "${GREEN}"
echo "╔════════════════════════════════════╗"
echo "║   ✓ NutriBot CRM запущен!          ║"
echo "╚════════════════════════════════════╝"
echo -e "${NC}"
echo "Mini App URL: $WEBAPP_URL"
echo ""
echo "Команды:"
echo "  make logs    — просмотр логов"
echo "  make backup  — создать бэкап БД"
echo "  make down    — остановить"
