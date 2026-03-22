# NutriBot CRM — Техническое описание

Документ для быстрого погружения в проект при доработках.

---

## Суть системы

CRM для одного пользователя (нутрициолога) работает **внутри Telegram** как Mini App.
Нутрициолог открывает приложение кнопкой в боте — видит клиентов, задачи, лидов.
Бот присылает уведомления каждое утро в 10:00 пн–пт (Europe/Kyiv).

---

## Стек и версии

| Компонент | Технология | Версия |
|-----------|------------|--------|
| Frontend | React + Vite | React 18, Vite 5 |
| Backend | Node.js + Fastify | Node 20, Fastify 4 |
| Database | PostgreSQL | 16 (alpine) |
| Scheduler | node-cron | v3 |
| Bot | node-telegram-bot-api | v0.66 |
| Reverse proxy | Nginx | 1.25 (alpine) |
| Container | Docker Compose | v2 |
| Test (BE) | Jest + Supertest | Jest 29 |
| Test (FE) | Vitest + Playwright | Vitest 2, PW 1.47 |

---

## Авторизация

**Telegram initData HMAC-SHA256** — единственный механизм auth.

```
Frontend → отправляет X-Telegram-Init-Data header (из window.Telegram.WebApp.initData)
Backend  → middleware/auth.js проверяет HMAC подпись
         → сверяет user.id с OWNER_TELEGRAM_ID из .env
         → 401 если подпись неверна, 403 если не владелец
```

В `NODE_ENV=test` — проверка отключена (bypass). В `NODE_ENV=development` — можно передать `'dev_bypass'` как initData.

Ключевой файл: `backend/src/middleware/auth.js`

---

## База данных

### Таблицы и зависимости

```
leads ←──────────────────────────────────────────────┐
  │ (circular FK через ALTER TABLE в migration 002)   │
  ↓                                                   │
clients ──→ leads (source_lead_id)                    │
  │                                                   │
  ├──→ payments ──→ payment_transactions              │
  ├──→ tasks                                          │
  └──→ calls ←── leads (для free_diagnostic)         │
                 leads.referred_by_client_id ─────────┘
                 leads.converted_to_client_id → clients
```

### Важные паттерны БД

- **UUID везде**: `DEFAULT gen_random_uuid()`
- **TIMESTAMPTZ**: всё хранится в UTC, отображается в Kyiv
- **Soft delete**: клиенты архивируются через `archived_at`, не удаляются
- **paid_amount вычисляется**: через VIEW `payments_with_totals` (JOIN с payment_transactions)
- **Circular FK**: leads ↔ clients решается через `ALTER TABLE` в конце migration 002 и 003
- **Trigger update_updated_at_column**: создаётся в migration 001, используется всеми таблицами

### Порядок миграций (важен)

```
001_leads.sql           → создаёт функцию trigger + таблицу leads (без FK на clients)
002_clients.sql         → создаёт clients + патчит FK в leads (referred_by, converted_to)
003_calls.sql           → создаёт calls + патчит FK в leads (diagnostic_call_id)
004_payments.sql        → payments + payment_transactions + VIEW payments_with_totals
005_tasks.sql           → tasks
006_notifications_log.sql → лог отправленных уведомлений (дедупликация)
```

Файл: `backend/src/db/migrate.js` — читает SQL файлы по алфавиту, записывает применённые в таблицу `migrations`.

---

## Backend архитектура

### Слои

```
routes/       → HTTP маршруты, валидация входных данных, вызов service
services/     → SQL запросы, бизнес-логика, транзакции
db/index.js   → pg Pool (max: 10 соединений), slow query warning >1s
middleware/   → auth decorator (декоратор Fastify, не middleware в классическом смысле)
bot/          → Telegram Bot singleton, webhook/polling, callback handlers
scheduler/    → Cron jobs, каждый job в отдельном файле
```

### Как добавить новый endpoint

1. Добавить метод в `services/xxx.service.js` (SQL)
2. Добавить route в `routes/xxx.js` с `{ preHandler: [app.authenticate] }`
3. Добавить тест в `tests/integration/xxx.test.js`

### Конвертация лида в клиента (критический flow)

Файл: `backend/src/services/leads.service.js` → `convertToClient()`

```
BEGIN TRANSACTION
  1. SELECT lead WHERE id=? AND converted_to_client_id IS NULL (защита от двойной конвертации)
  2. INSERT INTO clients (... source_lead_id = lead.id ...)
  3. UPDATE leads SET converted_to_client_id = new_client.id
COMMIT
```

### Scheduler — порядок выполнения

Файл: `backend/src/scheduler/jobs/daily.js`

```
1. tasksService.markOverdue()  ← сначала обновляем статусы
2. checkBirthdays()            ← ДР приоритет (отдельный cron, каждый день)
3. checkCallsTomorrow()
4. checkTaskDeadlines()
5. checkOverdueTasks()
6. checkPayments()             ← 3 проверки: послезавтра / сегодня / просрочка
7. checkLeads()
8. checkCourseEnds()
9. sendDigest()                ← только если есть события
```

### Дедупликация уведомлений

Файл: `backend/src/scheduler/jobs/notifications.helper.js`

```javascript
wasAlreadySentToday(type, entityId)
// SELECT 1 FROM notifications_log WHERE type=$1 AND entity_id=$2 AND sent_at::date = CURRENT_DATE
```

Каждое уведомление проверяется перед отправкой. Если уже слали сегодня — пропускаем.

---

## Frontend архитектура

### Структура компонентов

```
App.jsx
  └── BrowserRouter
      ├── /clients        → ClientsPage
      │     └── FAB → BottomSheet → ClientForm
      ├── /clients/:id    → ClientDetailPage
      │     └── BottomSheet x3 (payment / task / call)
      ├── /leads          → LeadsPage
      │     └── FAB → BottomSheet (inline form)
      └── /tasks          → TasksPage
      TabBar (fixed bottom, 3 tabs)
```

### Telegram WebApp интеграция

```javascript
// hooks/useTelegram.js
window.Telegram.WebApp.ready()   // сообщаем что загрузились
window.Telegram.WebApp.expand()  // разворачиваем на весь экран

// Тема: 'light' | 'dark'
document.documentElement.setAttribute('data-theme', tg.colorScheme)

// BackButton: показывается на detail страницах через useBackButton()
// Уведомляет о нажатии → navigate(-1)
```

### API запросы

Файл: `frontend/src/api/client.js`

Каждый запрос автоматически добавляет `X-Telegram-Init-Data` header из `window.Telegram.WebApp.initData`.

```javascript
// Паттерн использования в страницах:
const { data, loading, error, refetch } = useApi(() => clientsApi.list(), [deps])
```

### Дизайн-токены

Файл: `frontend/src/styles/tokens.css`

Ключевые цвета:
- `--leaf: #4E7A5A` — primary (кнопки, акцент)
- `--gold: #C8973C` — warning (оплаты, долги)
- `--blue: #5B8DD4` — info (лиды, созвоны)
- `--red: #C45A5A` — danger (просрочки)
- `--warm: #F5F0E8` — фон карточек

CSS Module Scope — все компоненты используют `*.module.css`.

---

## Бизнес-логика

### 6 типов работы с клиентом

| work_type | Срок | Созвоны | Продление |
|-----------|------|---------|-----------|
| `individual` | 3 мес | вводный + конец 1-го мес + 1-2/мес | +1, +2 мес |
| `family` | 3 мес | аналогично individual | да |
| `pregnancy_planning` | 3 мес | аналогично | да |
| `pregnancy_support` | 3 мес | аналогично | да |
| `express` | 1 мес | 1 созвон (вводный) | → scheme_3m |
| `scheme_3m` | 3 мес | иногда 1 (флаг has_call) | ещё одна схема |

### Статусы лида (воронка)

```
new → warm → negotiations → [client] (конвертация)
                          → club_member (купил клуб, остаётся тёплым)
                          → refused (пропал)
```

Уведомления не отправляются для `refused`. Для `club_member` — отправляются (нужно поддерживать контакт).

### 11 типов уведомлений

| # | Триггер | Файл |
|---|---------|------|
| 1 | ДР клиента (день совпадает) | `birthdays.js` |
| 2 | Созвон завтра (клиент) | `calls.js` |
| 3 | Диагностика лида завтра | `calls.js` |
| 4 | Дедлайн задачи через N дней | `tasks.js` |
| 5 | Задача просрочена | `tasks.js` |
| 6 | Платёж послезавтра | `payments.js` |
| 7 | Платёж сегодня | `payments.js` |
| 8 | Клиент не доплатил | `payments.js` |
| 9 | Напомнить о лиде | `leads.js` |
| 10 | Курс заканчивается через 7 дней | `courses.js` |
| 11 | Утренний дайджест | `digest.js` |

---

## Деплой и инфраструктура

### Docker сервисы

```
postgres  → порт только внутри сети nutrinet
backend   → :3000 (только через nginx)
nginx     → :80, :443 (публичный)
```

Frontend собирается (`npm run build` → `dist/`) и отдаётся nginx статикой. Нет отдельного frontend-контейнера в production.

### Переменные окружения (все в одном .env)

Ключевые:
- `DATABASE_URL` — полная строка подключения
- `BOT_TOKEN` — от @BotFather
- `OWNER_TELEGRAM_ID` — числовой Telegram ID владельца
- `WEBAPP_URL` — публичный URL (используется в кнопках уведомлений)
- `NOTIFICATIONS_HOUR` — час отправки (default: 10)
- `BACKUP_SSH_*` — для скачивания бэкапов с удалённого сервера

### Backup система

```bash
./scripts/backup.sh          # pg_dump | gzip → backups/nutricrm_ДАТА.sql.gz
./scripts/restore.sh FILE    # gunzip | psql (с подтверждением)
./scripts/download-backup.sh # rsync с удалённого сервера (нужны BACKUP_SSH_* в .env)
```

Автоматический бэкап: добавить в crontab `0 3 * * * cd /opt/nutricrm && ./scripts/backup.sh`

---

## Тесты

### Backend

```bash
cd backend
npm test                    # все тесты
npm run test:unit           # только unit (без БД)
npm run test:integration    # integration (нужна тестовая БД nutricrm_test)
```

Unit тесты мокируют `db` и `bot/index` через `jest.mock()`.
Integration тесты поднимают реальный Fastify с замоканным `authenticate`.

### Frontend

```bash
cd frontend
npm test                    # Vitest component тесты
npm run test:e2e            # Playwright (нужен запущенный dev сервер)
```

Telegram WebApp мокируется в `tests/setup.js` через `window.Telegram = {...}`.

---

## Часто нужные места

| Что найти | Где искать |
|-----------|------------|
| Добавить уведомление | `backend/src/scheduler/jobs/` → новый файл, подключить в `daily.js` |
| Добавить поле в клиента | `001_leads.sql` или `002_clients.sql` (новая миграция!) + `clients.service.js` + `ClientForm.jsx` |
| Изменить дизайн | `frontend/src/styles/tokens.css` (токены) или конкретный `*.module.css` |
| Добавить страницу | `frontend/src/pages/` + роут в `App.jsx` + таб в `TabBar.jsx` |
| Логи production | `make logs` или `docker compose logs -f backend` |
| SQL консоль | `make shell-db` |
| Посмотреть что слалось в бот | `SELECT * FROM notifications_log ORDER BY sent_at DESC LIMIT 20;` |

---

## Известные нюансы

1. **Circular FK**: leads ↔ clients — решено через ALTER TABLE в конце migration 002/003. Если добавляешь новые FK — учти этот паттерн.

2. **paid_amount не в таблице payments**: вычисляется через VIEW `payments_with_totals`. Всегда читать через этот view, не из таблицы напрямую.

3. **Bot polling vs webhook**: в `NODE_ENV=development` бот использует polling (не нужен публичный URL). В production — webhook на `WEBAPP_URL/bot/webhook`.

4. **ДР уведомление — каждый день**: остальные уведомления пн–пт. ДР — отдельный cron `* * * *` без ограничения по дням недели.

5. **Дедупликация через notifications_log**: если нужно тестировать уведомления — очищай таблицу: `DELETE FROM notifications_log WHERE sent_at::date = CURRENT_DATE;`

6. **Фронтенд не деплоится отдельно**: `npm run build` создаёт `dist/`, nginx отдаёт его статикой. setup.sh собирает фронтенд если нет `dist/`.
