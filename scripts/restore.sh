#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ]; then
  echo "Использование: ./scripts/restore.sh <путь_к_бэкапу.sql.gz>"
  echo ""
  echo "Доступные бэкапы:"
  ls -la backups/nutricrm_*.sql.gz 2>/dev/null || echo "  Бэкапы не найдены"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Ошибка: файл '$BACKUP_FILE' не найден"
  exit 1
fi

source .env

COMPOSE_CMD="docker compose"
command -v docker-compose &> /dev/null && COMPOSE_CMD="docker-compose"

echo "══════════════════════════════════════"
echo "  Восстановление БД из бэкапа"
echo "══════════════════════════════════════"
echo "Файл: $BACKUP_FILE"
echo "БД: $POSTGRES_DB"
echo ""
echo -e "\033[1;31mВНИМАНИЕ: Это перезапишет текущую базу данных!\033[0m"
echo -n "Продолжить? (введи 'yes' для подтверждения): "
read -r confirm

if [ "$confirm" != "yes" ]; then
  echo "Отменено."
  exit 0
fi

echo "Останавливаем backend..."
$COMPOSE_CMD stop backend

echo "Восстанавливаем БД..."
$COMPOSE_CMD exec -T postgres psql -U "$POSTGRES_USER" -c "DROP DATABASE IF EXISTS ${POSTGRES_DB}_restore_tmp;"
$COMPOSE_CMD exec -T postgres psql -U "$POSTGRES_USER" -c "CREATE DATABASE ${POSTGRES_DB}_restore_tmp;"
gunzip -c "$BACKUP_FILE" | $COMPOSE_CMD exec -T postgres psql -U "$POSTGRES_USER" "${POSTGRES_DB}_restore_tmp"

# Переключаем БД
$COMPOSE_CMD exec -T postgres psql -U "$POSTGRES_USER" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$POSTGRES_DB';"
$COMPOSE_CMD exec -T postgres psql -U "$POSTGRES_USER" -c "DROP DATABASE $POSTGRES_DB;"
$COMPOSE_CMD exec -T postgres psql -U "$POSTGRES_USER" -c "ALTER DATABASE ${POSTGRES_DB}_restore_tmp RENAME TO $POSTGRES_DB;"

echo "Запускаем backend..."
$COMPOSE_CMD start backend

echo "✓ Восстановление завершено успешно"
