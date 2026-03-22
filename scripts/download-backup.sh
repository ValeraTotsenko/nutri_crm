#!/usr/bin/env bash
set -euo pipefail

source .env

if [ -z "${BACKUP_SSH_HOST:-}" ] || [ -z "${BACKUP_SSH_USER:-}" ]; then
  echo "Ошибка: BACKUP_SSH_HOST и BACKUP_SSH_USER должны быть заданы в .env"
  exit 1
fi

REMOTE="${BACKUP_SSH_USER}@${BACKUP_SSH_HOST}:${BACKUP_REMOTE_PATH:-/backups/nutricrm}"
LOCAL_DIR="./backups"
mkdir -p "$LOCAL_DIR"

echo "Скачиваем последний бэкап с $BACKUP_SSH_HOST..."

# Получаем список бэкапов и берём последний
LATEST=$(ssh "${BACKUP_SSH_USER}@${BACKUP_SSH_HOST}" "ls -t ${BACKUP_REMOTE_PATH}/nutricrm_*.sql.gz 2>/dev/null | head -1")

if [ -z "$LATEST" ]; then
  echo "Ошибка: бэкапы не найдены на удалённом сервере"
  exit 1
fi

FILENAME=$(basename "$LATEST")
echo "Скачиваем: $FILENAME"

rsync -avz --progress "${BACKUP_SSH_USER}@${BACKUP_SSH_HOST}:${LATEST}" "$LOCAL_DIR/"

echo "✓ Бэкап скачан: $LOCAL_DIR/$FILENAME"
echo ""
echo "Для восстановления:"
echo "  ./scripts/restore.sh $LOCAL_DIR/$FILENAME"
