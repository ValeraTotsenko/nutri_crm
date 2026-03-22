# NutriBot CRM — Полный список задач

Статусы: `[ ]` — не начато | `[→]` — в работе | `[✓]` — выполнено

---

## ФАЗА 0: ИНФРАСТРУКТУРА

### 0.1 Структура проекта
- [ ] **INFRA-01** Создать файловую структуру проекта (backend/, frontend/, scripts/, nginx/)
- [ ] **INFRA-02** Инициализировать backend package.json (Fastify, pg, node-cron, node-telegram-bot-api, dotenv)
- [ ] **INFRA-03** Инициализировать frontend package.json (React, Vite, React Router)

### 0.2 Docker & Конфигурация
- [ ] **INFRA-04** Создать `.env.example` со ВСЕМИ переменными (БД, бот, токен, порты, TZ, owner ID)
- [ ] **INFRA-05** Создать `docker-compose.yml` (сервисы: postgres, backend, nginx; volumes, networks)
- [ ] **INFRA-06** Создать `backend/Dockerfile` (node:20-alpine, multi-stage)
- [ ] **INFRA-07** Создать `frontend/Dockerfile` (node build + nginx static)
- [ ] **INFRA-08** Создать `nginx/nginx.conf` (reverse proxy: /api → backend:3000, / → frontend static)

### 0.3 Скрипт деплоя
- [ ] **INFRA-09** Создать `setup.sh` — единый скрипт:
  - Проверка .env
  - docker-compose pull + build
  - docker-compose up -d
  - Запуск миграций
  - Healthcheck
- [ ] **INFRA-10** Создать `Makefile` с командами: `make up`, `make down`, `make logs`, `make backup`, `make restore`, `make shell-db`

### 0.4 Backup система
- [ ] **INFRA-11** Создать `scripts/backup.sh`:
  - pg_dump в /backups/nutricrm_YYYY-MM-DD_HH-MM.sql.gz
  - Ротация: хранить последние 30 бэкапов
  - Логирование
- [ ] **INFRA-12** Создать `scripts/restore.sh`:
  - Принимает путь к файлу бэкапа как аргумент
  - Останавливает backend, восстанавливает БД, стартует backend
  - Подтверждение перед восстановлением
- [ ] **INFRA-13** Создать `scripts/download-backup.sh`:
  - rsync/scp последнего бэкапа с удалённого сервера
  - Параметры: SERVER, USER, BACKUP_PATH из .env
- [ ] **INFRA-14** Настроить cron для автоматического бэкапа (docker exec + pg_dump ежедневно в 3:00)

---

## ФАЗА 1: БАЗА ДАННЫХ

### 1.1 Миграции
- [ ] **DB-01** `001_clients.sql` — таблица clients со всеми полями из ТЗ:
  - id UUID PK, last_name, first_name, birth_date, phone, telegram_username
  - work_type ENUM('individual','family','pregnancy_planning','pregnancy_support','express','scheme_3m')
  - goal TEXT, start_date DATE, end_date DATE
  - status ENUM('active','paused','completed','extended')
  - contraindications TEXT, notes TEXT, source_lead_id UUID FK
  - created_at, updated_at TIMESTAMP
- [ ] **DB-02** `002_leads.sql` — таблица leads:
  - id UUID PK, last_name, first_name, telegram_username, phone
  - status ENUM('new','warm','negotiations','refused','club_member')
  - interest TEXT, source VARCHAR, referred_by_client_id UUID FK
  - last_contact_at TIMESTAMP, remind_after_days INT DEFAULT 7
  - had_free_diagnostic BOOLEAN DEFAULT false
  - diagnostic_call_id UUID FK, converted_to_client_id UUID FK
  - notes TEXT, created_at, updated_at
- [ ] **DB-03** `003_payments.sql` — таблицы payments + payment_transactions:
  - payments: id, client_id FK, total_amount, paid_amount (computed), next_payment_date, overdue_days_threshold DEFAULT 2, currency DEFAULT 'UAH', notes
  - payment_transactions: id, payment_id FK, amount, paid_at DATE, method VARCHAR, note TEXT, created_at
- [ ] **DB-04** `004_tasks.sql` — таблица tasks:
  - id UUID PK, client_id UUID FK REQ
  - title VARCHAR(255), deadline_date DATE, remind_days_before INT DEFAULT 1
  - status ENUM('pending','in_progress','done','overdue')
  - priority ENUM('low','medium','high'), notes TEXT, completed_at TIMESTAMP
  - created_at, updated_at
- [ ] **DB-05** `005_calls.sql` — таблица calls:
  - id UUID PK, client_id UUID FK (nullable), lead_id UUID FK (nullable)
  - scheduled_at TIMESTAMP, call_type ENUM('intro','monthly','extra','free_diagnostic')
  - duration_min INT, platform VARCHAR(50)
  - status ENUM('scheduled','done','cancelled','no_show')
  - notes TEXT, created_at
- [ ] **DB-06** `006_notifications_log.sql` — лог уведомлений:
  - id UUID PK, type VARCHAR, entity_id UUID, entity_type VARCHAR
  - sent_at TIMESTAMP, message_text TEXT, tg_message_id BIGINT
- [ ] **DB-07** Индексы: clients(status), clients(birth_date), leads(status), leads(last_contact_at), tasks(deadline_date, status), calls(scheduled_at, status), payments(next_payment_date)

### 1.2 Запуск миграций
- [ ] **DB-08** `backend/src/db/migrate.js` — читает SQL файлы в порядке, выполняет при старте если не применены (таблица migrations)

---

## ФАЗА 2: BACKEND

### 2.1 Fastify App
- [ ] **BE-01** `backend/src/app.js` — Fastify instance, регистрация плагинов (cors, multipart, sensible)
- [ ] **BE-02** `backend/src/config.js` — все настройки из process.env с валидацией при старте
- [ ] **BE-03** `backend/src/db/index.js` — pg Pool, healthcheck функция
- [ ] **BE-04** `backend/src/middleware/auth.js` — проверка Telegram initData:
  - Валидация HMAC-SHA256 подписи
  - Проверка что user.id === OWNER_TELEGRAM_ID
  - Проброс 401 если не прошло

### 2.2 Clients API
- [ ] **BE-05** `GET /api/clients` — список: поиск, фильтр по work_type/status, сортировка
- [ ] **BE-06** `GET /api/clients/:id` — карточка клиента с joined данными (последний платёж, ближайший созвон, задачи)
- [ ] **BE-07** `POST /api/clients` — создание (валидация обязательных полей)
- [ ] **BE-08** `PATCH /api/clients/:id` — обновление карточки
- [ ] **BE-09** `DELETE /api/clients/:id` — мягкое удаление (archived флаг)

### 2.3 Leads API
- [ ] **BE-10** `GET /api/leads` — список с фильтрами (статус, без контакта 14д+)
- [ ] **BE-11** `GET /api/leads/:id` — карточка лида
- [ ] **BE-12** `POST /api/leads` — создание лида
- [ ] **BE-13** `PATCH /api/leads/:id` — обновление (включая last_contact_at)
- [ ] **BE-14** `POST /api/leads/:id/contact` — кнопка «Написала» → обновляет last_contact_at = NOW()
- [ ] **BE-15** `POST /api/leads/:id/convert` — конвертация лида в клиента:
  - Создаёт запись в clients с source_lead_id
  - Обновляет lead.converted_to_client_id
  - Возвращает нового клиента

### 2.4 Payments API
- [ ] **BE-16** `GET /api/clients/:id/payments` — история платежей клиента
- [ ] **BE-17** `POST /api/clients/:id/payments` — создание договора оплаты
- [ ] **BE-18** `PATCH /api/payments/:id` — обновление (next_payment_date, threshold)
- [ ] **BE-19** `POST /api/payments/:id/transactions` — внести платёж (обновляет paid_amount)
- [ ] **BE-20** `GET /api/payments/:id/transactions` — история транзакций

### 2.5 Tasks API
- [ ] **BE-21** `GET /api/tasks` — все задачи (фильтр: клиент, статус, просрочены)
- [ ] **BE-22** `GET /api/clients/:id/tasks` — задачи клиента
- [ ] **BE-23** `POST /api/tasks` — создание задачи
- [ ] **BE-24** `PATCH /api/tasks/:id` — обновление (статус, дедлайн)
- [ ] **BE-25** `POST /api/tasks/:id/complete` — закрыть задачу (completed_at = NOW())

### 2.6 Calls API
- [ ] **BE-26** `GET /api/clients/:id/calls` — созвоны клиента
- [ ] **BE-27** `GET /api/leads/:id/calls` — диагностики лида
- [ ] **BE-28** `POST /api/calls` — создание созвона
- [ ] **BE-29** `PATCH /api/calls/:id` — обновление (статус, перенос)
- [ ] **BE-30** `GET /api/calls/upcoming` — ближайшие созвоны (следующие 7 дней)

---

## ФАЗА 3: SCHEDULER & BOT

### 3.1 Telegram Bot
- [ ] **BOT-01** `backend/src/bot/index.js` — инициализация, polling/webhook режим
- [ ] **BOT-02** Команда /start — сохранение owner chat_id в .env / БД
- [ ] **BOT-03** `backend/src/bot/messages.js` — функции форматирования сообщений с inline keyboard
- [ ] **BOT-04** Обработчик callback_query для кнопок уведомлений (Написала, Закрыть задачу, etc.)

### 3.2 Уведомления (11 типов)
- [ ] **SCHED-01** `scheduler/index.js` — cron job Пн-Пт 10:00 Europe/Kyiv + ежедневно для ДР
- [ ] **SCHED-02** `jobs/birthdays.js` — ДР клиента (birth_date совпадает по дню/месяцу с сегодня)
- [ ] **SCHED-03** `jobs/calls.js` — созвон клиента завтра (call_type != free_diagnostic)
- [ ] **SCHED-04** `jobs/calls.js` — диагностика лида завтра (call_type = free_diagnostic)
- [ ] **SCHED-05** `jobs/tasks.js` — дедлайн задачи приближается (deadline - today = remind_days_before)
- [ ] **SCHED-06** `jobs/tasks.js` — задача просрочена (deadline < today, status pending/in_progress → overdue)
- [ ] **SCHED-07** `jobs/payments.js` — платёж послезавтра (next_payment_date - today = 2)
- [ ] **SCHED-08** `jobs/payments.js` — платёж сегодня (next_payment_date = today)
- [ ] **SCHED-09** `jobs/payments.js` — клиент не доплатил (today - next_payment_date = threshold)
- [ ] **SCHED-10** `jobs/leads.js` — напомнить о лиде (last_contact_at + remind_after_days ≤ today)
- [ ] **SCHED-11** `jobs/courses.js` — курс заканчивается (end_date - today = 7)
- [ ] **SCHED-12** `jobs/digest.js` — утренний дайджест (все события дня одним сообщением)
- [ ] **SCHED-13** Дедупликация: проверка notifications_log чтобы не слать одно и то же дважды в день

---

## ФАЗА 4: FRONTEND

### 4.1 Базовая Setup
- [ ] **FE-01** Vite + React + React Router v6 setup
- [ ] **FE-02** `src/styles/tokens.css` — CSS переменные дизайна (цвета, шрифты, радиусы)
- [ ] **FE-03** `src/styles/global.css` — базовые стили, адаптация под Telegram theme
- [ ] **FE-04** `src/hooks/useTelegram.js` — обёртка Telegram.WebApp (initData, theme, backButton, mainButton)
- [ ] **FE-05** `src/api/client.js` — fetch wrapper с auth header (initData), обработка ошибок
- [ ] **FE-06** `src/App.jsx` — Router, инициализация TG WebApp, глобальный theme

### 4.2 UI Kit компоненты
- [ ] **FE-07** `Button` — варианты: primary, secondary, danger, ghost; size: sm, md, lg (min 44px)
- [ ] **FE-08** `Badge` — статусы клиентов/лидов/задач с цветами
- [ ] **FE-09** `Card` — базовая карточка с заголовком и контентом
- [ ] **FE-10** `ProgressBar` — прогресс оплаты (paid/total)
- [ ] **FE-11** `TabBar` — нижняя навигация: Клиенты / Задачи / Лиды
- [ ] **FE-12** `FAB` — плавающая кнопка +
- [ ] **FE-13** `BottomSheet` — модальное окно снизу для форм
- [ ] **FE-14** `Input`, `Select`, `Textarea` — поля формы
- [ ] **FE-15** `PageHeader` — заголовок страницы с кнопкой назад

### 4.3 Клиенты
- [ ] **FE-16** `ClientsPage` — список клиентов: поиск, фильтр по work_type, сортировка
- [ ] **FE-17** `ClientCard` — карточка в списке: имя, тип, прогресс оплаты, бейдж статуса, ближайшее событие
- [ ] **FE-18** `ClientDetailPage` — детальная карточка клиента:
  - Шапка: имя, фамилия, тип работы, статус, ДР (с иконкой торта если сегодня)
  - Блок оплаты + прогресс-бар + история транзакций
  - Блок задач с дедлайнами
  - Блок созвонов (следующий + история)
  - Заметки
  - Кнопки действий
- [ ] **FE-19** `ClientForm` — форма добавления/редактирования клиента
- [ ] **FE-20** `PaymentForm` — форма внесения платежа / создания договора

### 4.4 Лиды
- [ ] **FE-21** `LeadsPage` — список лидов с вкладками: Все / Тёплые / Без контакта 14д+
- [ ] **FE-22** `LeadCard` — карточка: имя, статус, дней без контакта, источник, красная точка если 14д+
- [ ] **FE-23** `LeadDetailPage` — карточка лида: интерес, история контактов, диагностика
- [ ] **FE-24** `LeadForm` — форма добавления/редактирования лида
- [ ] **FE-25** Кнопки быстрых действий: «Написала», «Стала клиентом», «Отказалась», «Клуб»

### 4.5 Задачи
- [ ] **FE-26** `TasksPage` — все задачи с фильтрами (просроченные, по клиенту)
- [ ] **FE-27** `TaskCard` — задача с дедлайном, статусом, приоритетом
- [ ] **FE-28** `TaskForm` — форма создания/редактирования задачи (с remind_days_before)

### 4.6 Созвоны
- [ ] **FE-29** `CallForm` — форма добавления созвона (дата/время, тип, платформа)
- [ ] **FE-30** `CallCard` — карточка созвона с кнопками (Отменить, Выполнен, Перенести)

---

## ФАЗА 5: ТЕСТЫ

### Backend — Unit тесты
- [ ] **TEST-01** `tests/unit/services/clients.service.test.js` — CRUD логика клиентов
- [ ] **TEST-02** `tests/unit/services/leads.service.test.js` — конвертация, статусы
- [ ] **TEST-03** `tests/unit/services/payments.service.test.js` — расчёт paid_amount, просрочка
- [ ] **TEST-04** `tests/unit/services/tasks.service.test.js` — статус overdue логика
- [ ] **TEST-05** `tests/unit/scheduler/notifications.test.js` — каждый из 11 триггеров уведомлений
- [ ] **TEST-06** `tests/unit/middleware/auth.test.js` — HMAC валидация, 401 на неверный initData

### Backend — Integration тесты
- [ ] **TEST-07** `tests/integration/clients.test.js` — полный CRUD через HTTP (supertest)
- [ ] **TEST-08** `tests/integration/leads.test.js` — воронка лидов, конвертация в клиента
- [ ] **TEST-09** `tests/integration/payments.test.js` — создание платежа, внесение транзакции
- [ ] **TEST-10** `tests/integration/tasks.test.js` — создание, закрытие, просрочка
- [ ] **TEST-11** `tests/integration/calls.test.js` — CRUD созвонов, статусы
- [ ] **TEST-12** Тест дедупликации уведомлений (не слать дважды)

### Frontend — Component тесты
- [ ] **TEST-13** `tests/components/ClientCard.test.jsx` — рендер, статус бейджи, прогресс-бар
- [ ] **TEST-14** `tests/components/LeadCard.test.jsx` — индикатор 14дней+
- [ ] **TEST-15** `tests/components/TaskCard.test.jsx` — просроченные задачи
- [ ] **TEST-16** `tests/components/ProgressBar.test.jsx` — корректный % оплаты
- [ ] **TEST-17** `tests/components/forms/ClientForm.test.jsx` — валидация обязательных полей

### E2E тесты
- [ ] **TEST-18** `tests/e2e/clients-flow.spec.js` — создать клиента → добавить задачу → внести оплату
- [ ] **TEST-19** `tests/e2e/leads-flow.spec.js` — добавить лида → конвертировать в клиента
- [ ] **TEST-20** `tests/e2e/tasks-flow.spec.js` — создать задачу → закрыть задачу

---

## ФАЗА 6: ДЕПЛОЙ

- [ ] **DEPLOY-01** Проверка что `setup.sh` работает на чистом Ubuntu 22.04
- [ ] **DEPLOY-02** Проверка nginx конфига (HTTPS, заголовки безопасности)
- [ ] **DEPLOY-03** Настройка Telegram Bot Webhook (после получения SSL сертификата)
- [ ] **DEPLOY-04** README.md с инструкцией деплоя (установка, бэкап, восстановление, переезд)
- [ ] **DEPLOY-05** Проверка бэкапа: создать → скачать → восстановить на тестовой машине

---

## Зависимости задач

```
INFRA-01 → INFRA-02, INFRA-03, INFRA-04
INFRA-04 → INFRA-05, INFRA-06, INFRA-07, INFRA-09
INFRA-05 → DB-* (нужен postgres)
DB-01..06 → DB-07, DB-08 → BE-01..04
BE-01..04 → BE-05..30 (routes нужен app + db + auth)
BE-01..04 → BOT-01..04
BOT-01..04 → SCHED-01..13
BE-05..30 → TEST-07..12 (integration)
BE services → TEST-01..06 (unit)
FE-01..06 → FE-07..15 (ui kit)
FE-07..15 → FE-16..30 (pages)
FE-16..30 → TEST-13..17 (component)
FE-16..30 + BE ready → TEST-18..20 (e2e)
Всё → DEPLOY-01..05
```

---

## Критический путь (MVP за 2 недели)

**Неделя 1:** INFRA → DB → BE (clients + leads + payments + tasks + calls)
**Неделя 2:** BOT + SCHED → FE → Tests → Deploy
