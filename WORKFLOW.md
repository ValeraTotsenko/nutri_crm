# NutriBot CRM — Workflow разработки

## Обзор проекта

**Telegram Mini App** — CRM для нутрициолога. Один пользователь-владелец.
Стек: React + Vite / Node.js + Fastify / PostgreSQL / node-cron / node-telegram-bot-api.

---

## Структура проекта

```
nutriCRM/
├── .env.example                    # ВСЕ конфиги в одном файле
├── docker-compose.yml              # Все сервисы: backend, postgres, nginx
├── setup.sh                        # Единый скрипт: установка + деплой
├── Makefile                        # Шорткаты: make backup, make restore, etc.
│
├── scripts/
│   ├── backup.sh                   # Создание бэкапа БД
│   ├── restore.sh                  # Восстановление БД из бэкапа
│   └── download-backup.sh          # Скачать бэкап с сервера
│
├── nginx/
│   └── nginx.conf                  # Reverse proxy: /api → backend, / → frontend static
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── app.js                  # Fastify entry point
│   │   ├── config.js               # Все настройки из .env
│   │   ├── db/
│   │   │   ├── index.js            # pg pool connection
│   │   │   └── migrations/
│   │   │       ├── 001_clients.sql
│   │   │       ├── 002_leads.sql
│   │   │       ├── 003_payments.sql
│   │   │       ├── 004_tasks.sql
│   │   │       ├── 005_calls.sql
│   │   │       └── 006_notifications_log.sql
│   │   ├── middleware/
│   │   │   └── auth.js             # Telegram initData validation (HMAC)
│   │   ├── routes/
│   │   │   ├── clients.js
│   │   │   ├── leads.js
│   │   │   ├── payments.js
│   │   │   ├── tasks.js
│   │   │   └── calls.js
│   │   ├── services/
│   │   │   ├── clients.service.js
│   │   │   ├── leads.service.js
│   │   │   ├── payments.service.js
│   │   │   ├── tasks.service.js
│   │   │   ├── calls.service.js
│   │   │   └── notifications.service.js
│   │   ├── scheduler/
│   │   │   ├── index.js            # node-cron setup, Пн-Пт 10:00 Kyiv
│   │   │   └── jobs/
│   │   │       ├── birthdays.js    # Уведомление: ДР клиента
│   │   │       ├── calls.js        # Уведомление: созвон завтра
│   │   │       ├── tasks.js        # Уведомление: дедлайн + просрочка
│   │   │       ├── payments.js     # Уведомление: платёж / долг
│   │   │       ├── leads.js        # Уведомление: напомнить о лиде
│   │   │       ├── courses.js      # Уведомление: конец курса через 7 дней
│   │   │       └── digest.js       # Утренний дайджест
│   │   └── bot/
│   │       ├── index.js            # Bot init, webhook/polling
│   │       └── messages.js         # Шаблоны сообщений с кнопками
│   └── tests/
│       ├── unit/
│       │   ├── services/
│       │   └── scheduler/
│       └── integration/
│           ├── clients.test.js
│           ├── leads.test.js
│           ├── payments.test.js
│           ├── tasks.test.js
│           └── calls.test.js
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx                 # Router + TG theme init
    │   ├── api/
    │   │   ├── client.js           # fetch wrapper + auth header
    │   │   ├── clients.api.js
    │   │   ├── leads.api.js
    │   │   ├── payments.api.js
    │   │   ├── tasks.api.js
    │   │   └── calls.api.js
    │   ├── components/
    │   │   ├── ui/                 # Button, Badge, Card, ProgressBar, FAB
    │   │   ├── layout/             # TabBar, PageHeader, BottomSheet
    │   │   ├── clients/
    │   │   ├── leads/
    │   │   ├── payments/
    │   │   ├── tasks/
    │   │   └── calls/
    │   ├── pages/
    │   │   ├── ClientsPage.jsx
    │   │   ├── ClientDetailPage.jsx
    │   │   ├── LeadsPage.jsx
    │   │   ├── LeadDetailPage.jsx
    │   │   └── TasksPage.jsx
    │   ├── hooks/
    │   │   ├── useTelegram.js      # window.Telegram.WebApp wrapper
    │   │   └── useApi.js           # SWR/React Query хук
    │   └── styles/
    │       ├── tokens.css          # Дизайн-токены (цвета, отступы, шрифты)
    │       └── global.css
    └── tests/
        ├── components/             # Vitest + Testing Library
        └── e2e/                    # Playwright
```

---

## Фазы разработки

### Фаза 0 — Infrastructure (День 1)
**Агент: DevOps Agent**
- Структура папок и файлов
- docker-compose.yml (postgres + backend + nginx)
- .env.example со всеми переменными
- setup.sh — единый скрипт установки
- Скрипты backup/restore/download
- Makefile с командами

### Фаза 1 — Database (День 1-2)
**Агент: Database Agent**
- SQL миграции для всех 6 таблиц
- Индексы и constraints
- Функция запуска миграций при старте

### Фаза 2 — Backend Core (День 2-4)
**Агент: Backend Agent**
- Fastify app setup
- Auth middleware (Telegram initData HMAC)
- CRUD routes для: clients, leads, payments, tasks, calls
- Бизнес-логика: конвертация лида в клиента
- Services layer с SQL

### Фаза 3 — Scheduler & Bot (День 4-5)
**Агент: Scheduler Agent**
- Telegram Bot инициализация
- 11 типов уведомлений
- node-cron: Пн–Пт 10:00 Europe/Kyiv
- ДР уведомления — каждый день

### Фаза 4 — Frontend (День 5-8)
**Агент: Frontend Agent**
- React + Vite + Telegram WebApp SDK
- Design system компоненты
- 3 главных таба: Клиенты / Задачи / Лиды
- Все экраны и формы

### Фаза 5 — Tests (параллельно с кодом)
**Агент: Test Agent**
- Unit тесты сервисов
- Integration тесты API (supertest)
- Component тесты (Vitest)
- E2E тесты (Playwright)

### Фаза 6 — Deploy & Docs (День 9-10)
**Агент: DevOps Agent**
- Финальная проверка docker-compose
- Nginx конфиг
- README с инструкцией деплоя

---

## Порядок запуска агентов

```
[DevOps Agent]          → создаёт инфраструктуру
       ↓
[Database Agent]        → создаёт миграции
       ↓
[Backend Agent]         → разрабатывает API
       ↓
[Scheduler Agent]       → подключает бот и cron
       ↓
[Frontend Agent]        → строит Mini App
       ↓
[Test Agent]            → пишет тесты (частично параллельно)
       ↓
[DevOps Agent]          → финальный деплой и проверка
```

---

## Правила для всех агентов

1. **Один .env** — все конфиги только через process.env, никаких хардкодов
2. **Docker-first** — всё запускается через docker-compose up
3. **Тесты обязательны** — каждый модуль покрывается тестами
4. **Timezone** — везде Europe/Kyiv, хранить UTC в БД
5. **UUID** — все primary keys — UUID v4
6. **Migrations** — только вперёд, без rollback (append-only)
7. **Auth** — каждый API запрос проверяет Telegram initData
