#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

source "$PROJECT_DIR/.env"

BACKUP_DIR="$PROJECT_DIR/backups"
mkdir -p "$BACKUP_DIR"

FILENAME="nutricrm_$(date +%Y-%m-%d_%H-%M).sql.gz"
FILEPATH="$BACKUP_DIR/$FILENAME"

COMPOSE_CMD="docker compose"
command -v docker-compose &> /dev/null && COMPOSE_CMD="docker-compose"

echo "Создаём бэкап: $FILENAME"
cd "$PROJECT_DIR"
$COMPOSE_CMD exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$FILEPATH"

SIZE=$(du -sh "$FILEPATH" | cut -f1)
echo "✓ Бэкап создан: $FILEPATH ($SIZE)"

# Ротация: удалить старые бэкапы
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
DELETED=$(find "$BACKUP_DIR" -name "nutricrm_*.sql.gz" -mtime +"$KEEP_DAYS" -print -delete | wc -l)
[ "$DELETED" -gt 0 ] && echo "Удалено старых бэкапов: $DELETED"

echo "Всего бэкапов: $(ls "$BACKUP_DIR"/nutricrm_*.sql.gz 2>/dev/null | wc -l)"
