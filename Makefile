.PHONY: up down restart logs backup restore shell-db shell-backend migrate build

# Определяем compose команду
COMPOSE := $(shell command -v docker-compose 2>/dev/null || echo "docker compose")

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart

logs:
	$(COMPOSE) logs -f --tail=100

build:
	$(COMPOSE) build --no-cache

migrate:
	$(COMPOSE) exec backend node src/db/migrate.js

backup:
	./scripts/backup.sh

restore:
	@echo "Использование: make restore FILE=backups/nutricrm_2024-01-01_10-00.sql.gz"
	./scripts/restore.sh $(FILE)

download-backup:
	./scripts/download-backup.sh

shell-db:
	$(COMPOSE) exec postgres psql -U $$POSTGRES_USER -d $$POSTGRES_DB

shell-backend:
	$(COMPOSE) exec backend sh

ps:
	$(COMPOSE) ps

setup:
	./setup.sh
