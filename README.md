# NutriBot CRM

CRM-система для нутрициолога в Telegram Mini App.

**Стек:** React + Vite / Node.js + Fastify / PostgreSQL / node-cron / Telegram Bot API
**Деплой:** Docker Compose + Nginx
**Один пользователь:** владелец (нутрициолог)

---

## Быстрый старт (деплой на сервер)

### 1. Требования
- Ubuntu 20.04+ / Debian 11+
- Docker 24+ и Docker Compose v2
- Доменное имя (для HTTPS и Telegram Bot Webhook)

### 2. Установка Docker (если не установлен)
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

### 3. Клонирование проекта
```bash
git clone <ваш-репозиторий> /opt/nutricrm
cd /opt/nutricrm
```

### 4. Настройка конфигурации
```bash
cp .env.example .env
nano .env
```

Обязательно заполнить:
| Переменная | Описание |
|------------|----------|
| `POSTGRES_PASSWORD` | Сложный пароль для БД |
| `BOT_TOKEN` | Токен бота от @BotFather |
| `OWNER_TELEGRAM_ID` | Ваш Telegram ID (узнать у @userinfobot) |
| `WEBAPP_URL` | URL вашего сайта (https://yourdomain.com) |

### 5. Деплой одной командой
```bash
chmod +x setup.sh scripts/*.sh
./setup.sh
```

Скрипт автоматически:
- Проверит наличие .env и обязательных переменных
- Соберёт Docker образы
- Запустит все контейнеры
- Дождётся готовности PostgreSQL
- Применит миграции БД
- Проверит healthcheck

### 6. Настройка Telegram Bot Webhook (для production)
```bash
# После настройки SSL/домена:
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://yourdomain.com/bot/webhook"
```

---

## Управление

```bash
make logs          # Логи всех сервисов
make logs          # или: docker compose logs -f
make ps            # Статус контейнеров
make down          # Остановить
make up            # Запустить
make restart       # Перезапустить
make migrate       # Применить новые миграции
make shell-db      # Консоль PostgreSQL
make shell-backend # Shell внутри backend контейнера
```

---

## Резервные копии (Backup)

### Создать бэкап вручную
```bash
make backup
# или
./scripts/backup.sh
```
Бэкапы сохраняются в `./backups/nutricrm_YYYY-MM-DD_HH-MM.sql.gz`
Автоматически удаляются через `BACKUP_KEEP_DAYS` дней (по умолчанию 30).

### Автоматический бэкап (cron на сервере)
```bash
# Добавить в crontab: ежедневно в 3:00
crontab -e
# Добавить строку:
0 3 * * * cd /opt/nutricrm && ./scripts/backup.sh >> /var/log/nutricrm-backup.log 2>&1
```

### Скачать бэкап с сервера
```bash
# На локальной машине:
cp .env.example .env
# Заполнить BACKUP_SSH_USER, BACKUP_SSH_HOST, BACKUP_REMOTE_PATH
./scripts/download-backup.sh
```

---

## Восстановление (Restore)

### На том же сервере
```bash
# Список доступных бэкапов:
ls backups/

# Восстановление (потребует подтверждение):
./scripts/restore.sh backups/nutricrm_2024-01-15_03-00.sql.gz
```

### Переезд на другой сервер

1. **На старом сервере** — создать и скачать бэкап:
```bash
./scripts/backup.sh
# Скачать файл из backups/ через scp/rsync
```

2. **На новом сервере** — установить проект:
```bash
git clone <репозиторий> /opt/nutricrm
cd /opt/nutricrm
cp .env.example .env && nano .env  # Заполнить те же значения
chmod +x setup.sh scripts/*.sh
./setup.sh  # Запустит с пустой БД
```

3. **Восстановить данные**:
```bash
# Скопировать файл бэкапа на новый сервер:
scp old-server:/opt/nutricrm/backups/nutricrm_2024-01-15.sql.gz ./backups/

# Восстановить:
./scripts/restore.sh backups/nutricrm_2024-01-15.sql.gz
```

4. **Обновить Webhook**:
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://new-domain.com/bot/webhook"
```

---

## Разработка локально

### Требования
- Node.js 20+
- PostgreSQL 16 (или через Docker)

### Запуск через Docker (рекомендуется)
```bash
cp .env.example .env
# Поставить NODE_ENV=development, добавить BOT_TOKEN и OWNER_TELEGRAM_ID
docker compose up -d postgres  # Только БД
cd backend && npm install && npm run dev  # Backend на :3000
cd frontend && npm install && npm run dev  # Frontend на :5173
```

### Переменные для разработки
```env
NODE_ENV=development
DATABASE_URL=postgresql://nutricrm:password@localhost:5432/nutricrm
BOT_TOKEN=your_test_bot_token
OWNER_TELEGRAM_ID=your_telegram_id
WEBAPP_URL=http://localhost:5173
```

---

## Тесты

```bash
# Backend — unit тесты
cd backend && npm test

# Backend — только unit
npm run test:unit

# Backend — integration (нужна тестовая БД)
DATABASE_URL=postgresql://nutricrm:pass@localhost:5432/nutricrm_test npm run test:integration

# Frontend — component тесты
cd frontend && npm test

# Frontend — E2E (нужен запущенный frontend)
npm run test:e2e
```

---

## Архитектура

```
Telegram Mini App (React)
        ↕ REST API
    Fastify Backend
    ├── /api/clients   — CRUD клиентов
    ├── /api/leads     — Воронка лидов
    ├── /api/tasks     — Задачи
    ├── /api/payments  — Оплаты
    ├── /api/calls     — Созвоны
    └── /bot/webhook   — Telegram Bot
        ↕
    PostgreSQL
    ├── clients
    ├── leads
    ├── payments + payment_transactions
    ├── tasks
    ├── calls
    └── notifications_log

Scheduler (node-cron)
└── Пн–Пт 10:00 Europe/Kyiv
    ├── День рождения клиента
    ├── Созвон завтра
    ├── Диагностика лида завтра
    ├── Дедлайн задачи
    ├── Задача просрочена
    ├── Платёж послезавтра
    ├── Платёж сегодня
    ├── Клиент не доплатил
    ├── Напомнить о лиде
    ├── Курс заканчивается
    └── Утренний дайджест
```

---

## Структура файлов

```
nutriCRM/
├── .env.example          # Шаблон конфигурации
├── docker-compose.yml    # Все сервисы
├── setup.sh              # Единый скрипт деплоя
├── Makefile              # Команды управления
├── scripts/
│   ├── backup.sh         # Создать бэкап
│   ├── restore.sh        # Восстановить бэкап
│   └── download-backup.sh # Скачать бэкап с сервера
├── nginx/nginx.conf      # Reverse proxy
├── backend/
│   ├── src/
│   │   ├── app.js            # Entry point
│   │   ├── config.js         # Конфигурация
│   │   ├── db/               # PostgreSQL + миграции
│   │   ├── middleware/auth.js # Telegram auth
│   │   ├── routes/           # API endpoints
│   │   ├── services/         # Бизнес-логика
│   │   ├── scheduler/        # Cron + уведомления
│   │   └── bot/              # Telegram Bot
│   └── tests/
│       ├── unit/
│       └── integration/
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── api/          # API клиент
    │   ├── components/   # UI компоненты
    │   ├── pages/        # Страницы
    │   ├── hooks/        # useTelegram, useApi
    │   └── styles/       # Design tokens + global
    └── tests/
        ├── components/
        └── e2e/
```

---

## Безопасность

- Все запросы к API проверяют **Telegram initData** (HMAC-SHA256)
- Доступ только для **одного владельца** (OWNER_TELEGRAM_ID)
- HTTPS через nginx (настройте SSL сертификат)
- Rate limiting: 30 req/s на /api/
- Пароли только в .env (не в коде, не в git)

---

## Обновление приложения

```bash
git pull
./setup.sh  # Пересоберёт и перезапустит, применит новые миграции
```
