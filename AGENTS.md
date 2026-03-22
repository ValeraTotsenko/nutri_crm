# NutriBot CRM — Агентские инструкции

Этот файл содержит инструкции для каждого специализированного агента.
Агенты работают последовательно согласно workflow в `WORKFLOW.md`.

---

## AGENT 1: DevOps Agent

### Роль
Создаёт инфраструктуру проекта: Docker, скрипты, nginx, backup система.

### Задачи
INFRA-01 → INFRA-14 (все задачи из фазы 0 в TASKS.md)

### Инструкции

**docker-compose.yml** должен содержать:
```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: always
    env_file: .env
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./backups:/backups        # для бэкапов

  backend:
    build: ./backend
    restart: always
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
    ports: [не экспонировать напрямую, только через nginx]

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./frontend/dist:/usr/share/nginx/html:ro  # собранный фронтенд

volumes:
  pgdata:
```

**.env.example** — обязательные переменные:
```
# База данных
POSTGRES_DB=nutricrm
POSTGRES_USER=nutricrm
POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD
DATABASE_URL=postgresql://nutricrm:CHANGE_ME_STRONG_PASSWORD@postgres:5432/nutricrm

# Telegram
BOT_TOKEN=
OWNER_TELEGRAM_ID=
WEBAPP_URL=https://yourdomain.com

# Backend
PORT=3000
NODE_ENV=production
JWT_SECRET=CHANGE_ME_JWT_SECRET
TZ=Europe/Kyiv
NOTIFICATIONS_HOUR=10
NOTIFICATIONS_TZ=Europe/Kyiv

# Backup
BACKUP_SSH_USER=
BACKUP_SSH_HOST=
BACKUP_REMOTE_PATH=/backups/nutricrm
BACKUP_KEEP_DAYS=30
```

**setup.sh** — логика:
1. `[ -f .env ] || { echo "Скопируй .env.example в .env и заполни"; exit 1; }`
2. Проверить что docker + docker-compose установлены
3. `docker-compose build --no-cache`
4. `docker-compose up -d`
5. Подождать healthcheck postgres (до 30 сек)
6. `docker-compose exec backend node src/db/migrate.js`
7. `echo "✓ NutriBot CRM запущен"`

**backup.sh** — логика:
```bash
#!/bin/bash
BACKUP_DIR="./backups"
FILENAME="nutricrm_$(date +%Y-%m-%d_%H-%M).sql.gz"
docker-compose exec -T postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > "$BACKUP_DIR/$FILENAME"
# Удалить старые (старше BACKUP_KEEP_DAYS)
find $BACKUP_DIR -name "*.sql.gz" -mtime +${BACKUP_KEEP_DAYS:-30} -delete
echo "Backup created: $FILENAME"
```

**restore.sh** — логика:
```bash
#!/bin/bash
BACKUP_FILE="$1"
[ -z "$BACKUP_FILE" ] && { echo "Usage: ./scripts/restore.sh <backup_file.sql.gz>"; exit 1; }
echo "Восстановление из: $BACKUP_FILE"
echo "Это перезапишет текущую БД! Продолжить? (y/N)"
read -r confirm
[ "$confirm" = "y" ] || exit 0
docker-compose stop backend
gunzip -c "$BACKUP_FILE" | docker-compose exec -T postgres psql -U $POSTGRES_USER $POSTGRES_DB
docker-compose start backend
echo "✓ Восстановление завершено"
```

### Что НЕ делать
- Не экспонировать backend порт напрямую (только через nginx)
- Не хранить пароли в docker-compose.yml (только env_file: .env)
- Не делать rollback миграций

---

## AGENT 2: Database Agent

### Роль
Создаёт SQL миграции для всех 6 таблиц и механизм их запуска.

### Задачи
DB-01 → DB-08 (все задачи из фазы 1 в TASKS.md)

### Инструкции

**Общие правила:**
- UUID v4 для всех PK: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- Timestamps: `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()`
- Trigg для updated_at на каждой таблице
- Все ENUMs объявлять как CREATE TYPE перед таблицей
- FK с ON DELETE RESTRICT (не терять данные)

**Порядок файлов важен** (FK зависимости):
1. leads (нет FK на другие таблицы — circular будет решён через nullable FK)
2. clients (FK → leads через source_lead_id)
3. calls (FK → clients, leads)
4. payments (FK → clients)
5. payment_transactions (FK → payments)
6. tasks (FK → clients)
7. notifications_log

**Пример структуры миграционного файла:**
```sql
-- migrations/001_clients.sql
BEGIN;

CREATE TYPE work_type_enum AS ENUM (
  'individual', 'family', 'pregnancy_planning',
  'pregnancy_support', 'express', 'scheme_3m'
);

CREATE TYPE client_status_enum AS ENUM (
  'active', 'paused', 'completed', 'extended'
);

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_name VARCHAR(100) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  birth_date DATE,
  phone VARCHAR(20),
  telegram_username VARCHAR(50),
  work_type work_type_enum NOT NULL,
  goal TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  status client_status_enum NOT NULL DEFAULT 'active',
  contraindications TEXT,
  notes TEXT,
  source_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_birth_date ON clients(birth_date);
CREATE INDEX idx_clients_work_type ON clients(work_type);

COMMIT;
```

**migrate.js** — механизм:
```javascript
// Создать таблицу migrations если нет
// Прочитать все *.sql файлы из migrations/ в алфавитном порядке
// Для каждого: проверить в таблице migrations, применён ли
// Если нет — выполнить, записать в migrations
```

### Что НЕ делать
- Не использовать SERIAL/BIGSERIAL — только UUID
- Не хранить деньги в FLOAT — только DECIMAL(10,2)
- Не хранить время без timezone — только TIMESTAMPTZ

---

## AGENT 3: Backend Agent

### Роль
Разрабатывает REST API на Fastify: все routes, services, middleware.

### Задачи
BE-01 → BE-30 (все задачи из фазы 2 в TASKS.md)

### Инструкции

**Структура Fastify app:**
```javascript
// app.js
const app = Fastify({ logger: true })
await app.register(require('@fastify/cors'))
await app.register(require('@fastify/sensible'))
// Auth декоратор
app.decorate('authenticate', authMiddleware)
// Routes
app.register(require('./routes/clients'), { prefix: '/api' })
app.register(require('./routes/leads'), { prefix: '/api' })
// ... etc
```

**Auth middleware (ОБЯЗАТЕЛЬНО на каждом route):**
```javascript
// Telegram initData validation
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
const crypto = require('crypto')
function validateTelegramInitData(initData, botToken) {
  const urlParams = new URLSearchParams(initData)
  const hash = urlParams.get('hash')
  urlParams.delete('hash')
  const dataCheckString = [...urlParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  return expectedHash === hash
}
```

**Services pattern:**
```javascript
// clients.service.js — только SQL, никакой логики маршрутов
class ClientsService {
  constructor(db) { this.db = db }
  async findAll({ search, workType, status, sort }) { ... }
  async findById(id) { ... }
  async create(data) { ... }
  async update(id, data) { ... }
  async archive(id) { ... } // мягкое удаление
}
```

**Routes pattern:**
```javascript
// routes/clients.js
module.exports = async function (app) {
  app.get('/clients', { preHandler: [app.authenticate] }, async (req, reply) => {
    const clients = await clientsService.findAll(req.query)
    return clients
  })
  // ...
}
```

**Конвертация лида в клиента (BE-15) — критическая логика:**
```
1. Проверить что lead существует и не converted уже
2. BEGIN TRANSACTION
3. INSERT INTO clients (... source_lead_id = lead.id ...)
4. UPDATE leads SET converted_to_client_id = new_client.id, status = 'converted'
5. COMMIT
6. Вернуть нового клиента
```

**Обработка ошибок:**
- 400 — валидационные ошибки (joi/ajv схемы)
- 401 — неверный initData
- 403 — не owner
- 404 — сущность не найдена
- 500 — серверная ошибка (логировать, не возвращать детали)

### Что НЕ делать
- Не делать SQL запросы прямо в routes — только через services
- Не возвращать пароли или sensitive данные
- Не забывать архивировать вместо физического удаления клиентов

---

## AGENT 4: Scheduler Agent

### Роль
Telegram бот + планировщик уведомлений (11 типов).

### Задачи
BOT-01 → BOT-04, SCHED-01 → SCHED-13

### Инструкции

**Bot инициализация:**
```javascript
const TelegramBot = require('node-telegram-bot-api')
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  // polling в dev, webhook в prod
  polling: process.env.NODE_ENV !== 'production'
})
// Webhook endpoint: POST /bot/webhook
```

**Cron расписание:**
```javascript
const cron = require('node-cron')
// Рабочие дни 10:00 Kiev
cron.schedule('0 10 * * 1-5', runDailyJobs, {
  timezone: 'Europe/Kyiv'
})
// ДР — каждый день (включая выходные)
cron.schedule('0 10 * * *', checkBirthdays, {
  timezone: 'Europe/Kyiv'
})
```

**Порядок отправки в runDailyJobs:**
```
1. checkBirthdays()       // ДР — приоритет
2. checkCallsTomorrow()   // Созвоны завтра
3. checkDiagnostics()     // Диагностики лидов завтра
4. checkTaskDeadlines()   // Дедлайны задач
5. checkOverdueTasks()    // Просроченные задачи
6. checkPayments()        // Платёжи (послезавтра + сегодня + просрочка)
7. checkLeads()           // Напомнить о лидах
8. checkCourseEnds()      // Конец курса через 7 дней
9. sendDigest()           // Дайджест (если есть события)
```

**Дедупликация — ВАЖНО:**
```javascript
// Перед отправкой любого уведомления:
async function wasAlreadySentToday(type, entityId) {
  const result = await db.query(
    `SELECT 1 FROM notifications_log
     WHERE type = $1 AND entity_id = $2
     AND sent_at::date = CURRENT_DATE`,
    [type, entityId]
  )
  return result.rows.length > 0
}
```

**Шаблон уведомления (пример — ДР):**
```javascript
async function sendBirthday(client) {
  if (await wasAlreadySentToday('birthday', client.id)) return

  const text = `🎂 *День рождения!*\n` +
    `Сегодня день рождения *${client.last_name} ${client.first_name}*\n` +
    `🎯 Цель: ${client.goal || '—'} · Тип: ${workTypeLabel(client.work_type)}\n` +
    `_Не забудьте поздравить клиента ✨_`

  const opts = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: 'Открыть карточку', web_app: { url: `${WEBAPP_URL}/clients/${client.id}` } },
        { text: 'Написать поздравление', url: `https://t.me/${client.telegram_username}` }
      ]]
    }
  }

  const msg = await bot.sendMessage(OWNER_CHAT_ID, text, opts)
  await logNotification('birthday', client.id, text, msg.message_id)
}
```

**Callback query handler:**
```javascript
bot.on('callback_query', async (query) => {
  const [action, entityId] = query.data.split(':')
  switch(action) {
    case 'lead_contacted': // Написала → обновить last_contact_at
    case 'task_done': // Закрыть задачу
    case 'lead_convert': // Конвертировать в клиента
    // ...
  }
  await bot.answerCallbackQuery(query.id)
})
```

### Что НЕ делать
- Не отправлять уведомления без проверки дедупликации
- Не слать уведомления лидам со статусом 'refused'
- Не запускать scheduler в тестовой среде
- Не хранить OWNER_CHAT_ID в коде — только в .env

---

## AGENT 5: Frontend Agent

### Роль
Строит Telegram Mini App на React + Vite согласно дизайну из `nutribot-design-reference.html`.

### Задачи
FE-01 → FE-30 (все задачи из фазы 4 в TASKS.md)

### Инструкции

**Telegram WebApp инициализация:**
```javascript
// hooks/useTelegram.js
const tg = window.Telegram?.WebApp
export function useTelegram() {
  useEffect(() => {
    tg?.ready()
    tg?.expand()
  }, [])
  return {
    initData: tg?.initData,
    theme: tg?.colorScheme, // 'light' | 'dark'
    user: tg?.initDataUnsafe?.user,
    backButton: tg?.BackButton,
    mainButton: tg?.MainButton,
  }
}
```

**API client с auth:**
```javascript
// api/client.js
const BASE_URL = import.meta.env.VITE_API_URL || '/api'
const initData = window.Telegram?.WebApp?.initData || ''

export async function apiRequest(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': initData,
      ...options.headers,
    },
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}
```

**Дизайн-токены (из референса):**
```css
/* styles/tokens.css */
:root {
  --leaf: #4E7A5A;       /* primary accent, кнопки */
  --gold: #C8973C;       /* warning, оплаты */
  --blue: #5B8DD4;       /* info, лиды, созвоны */
  --red: #C45A5A;        /* danger, просрочки */
  --warm: #F5F0E8;       /* surface, фон карточек */
  --ink: #141918;        /* основной текст */

  --font-display: 'Fraunces', serif;
  --font-ui: 'DM Sans', sans-serif;

  --text-xl: 20px;
  --text-lg: 16px;
  --text-md: 14px;
  --text-sm: 12px;
  --text-xs: 10px;

  --r-sm: 8px;
  --r-md: 14px;
  --r-lg: 20px;
  --r-pill: 999px;
}
/* Тёмная тема через Telegram */
[data-theme="dark"] {
  --warm: #1A1E1B;
  --ink: #E8EDE9;
}
```

**Навигация — 3 таба:**
```jsx
// TabBar.jsx — нижняя навигация
const tabs = [
  { path: '/clients', icon: '👥', label: 'Клиенты' },
  { path: '/tasks', icon: '✅', label: 'Задачи' },
  { path: '/leads', icon: '🎯', label: 'Лиды' },
]
```

**Карточка клиента — прогресс-бар оплаты:**
```jsx
// ProgressBar.jsx
const percent = Math.min(100, (paidAmount / totalAmount) * 100)
// Цвет: зелёный если 100%, жёлтый если <100%, красный если просрочка
```

**Статусные бейджи:**
```
clients.status:
  active → зелёный
  paused → жёлтый
  completed → серый
  extended → синий

leads.status:
  new → серый
  warm → жёлтый
  negotiations → синий
  club_member → фиолетовый
  refused → красный

tasks.status:
  pending → серый
  in_progress → синий
  done → зелёный
  overdue → красный
```

**UX правила:**
- Все кнопки минимум 44px высотой (thumb-friendly)
- FAB для добавления (+ клиент / + лид / + задача)
- BottomSheet для форм (не отдельная страница)
- BackButton Telegram для навигации назад
- Skeleton loader во время загрузки
- Оптимистичные обновления для быстрых действий (Написала, Закрыть)

### Что НЕ делать
- Не делать отдельные страницы для форм — использовать BottomSheet
- Не хранить initData в localStorage
- Не игнорировать dark/light theme Telegram
- Не делать кнопки меньше 44px

---

## AGENT 6: Test Agent

### Роль
Пишет тесты для всех модулей. Работает параллельно с разработкой.

### Задачи
TEST-01 → TEST-20 (все задачи из фазы 5 в TASKS.md)

### Инструкции

**Backend тест-стек:**
- Jest + Supertest для integration
- Jest + mock pg для unit
- Тестовая БД: отдельный POSTGRES_DB_TEST

**Frontend тест-стек:**
- Vitest + @testing-library/react для components
- Playwright для E2E

**Unit тест — сервис (пример):**
```javascript
// tests/unit/services/payments.service.test.js
describe('PaymentsService', () => {
  test('paid_amount вычисляется из транзакций', async () => {
    // mock db
    // создать payment с 2 транзакциями
    // проверить paid_amount = сумма транзакций
  })

  test('overdue определяется корректно', () => {
    const payment = { next_payment_date: '2024-01-01', overdue_days_threshold: 2 }
    const today = new Date('2024-01-03')
    expect(isOverdue(payment, today)).toBe(true)
  })
})
```

**Integration тест (пример):**
```javascript
// tests/integration/leads.test.js
describe('POST /api/leads/:id/convert', () => {
  test('конвертация лида в клиента', async () => {
    // 1. Создать лида через API
    // 2. Конвертировать
    // 3. Проверить что клиент создан с source_lead_id
    // 4. Проверить что lead.converted_to_client_id заполнен
    // 5. Повторная конвертация → 400
  })
})
```

**Scheduler тест — каждый из 11 триггеров:**
```javascript
// tests/unit/scheduler/notifications.test.js
describe('Birthday notification', () => {
  test('отправляет уведомление если ДР сегодня', async () => {
    // mock TODAY = client.birth_date (же день и месяц)
    // mock bot.sendMessage
    // запустить checkBirthdays()
    // проверить что bot.sendMessage был вызван
  })

  test('не отправляет если уже было сегодня', async () => {
    // mock notifications_log с записью на сегодня
    // проверить что bot.sendMessage НЕ вызван
  })
})
```

**E2E тест (пример):**
```javascript
// tests/e2e/clients-flow.spec.js
test('создать клиента → добавить задачу → внести оплату', async ({ page }) => {
  // 1. Открыть Mini App (через Playwright)
  // 2. Нажать FAB + → Клиент
  // 3. Заполнить форму, сохранить
  // 4. Открыть карточку нового клиента
  // 5. Добавить задачу с дедлайном
  // 6. Внести оплату
  // 7. Проверить прогресс-бар обновился
})
```

### Что НЕ делать
- Не мокировать БД в integration тестах — использовать реальную тестовую БД
- Не пропускать тест дедупликации уведомлений
- Не делать тесты зависящими от порядка выполнения

---

## Общие правила для всех агентов

1. **Читай TASKS.md** перед началом — там полный список с зависимостями
2. **Отмечай задачи** как выполненные `[✓]` в TASKS.md
3. **Один .env** — никаких хардкодов, всё через process.env
4. **Docker-first** — код должен работать в контейнере
5. **Timezone** — хранить UTC, отображать Europe/Kyiv
6. **UUID везде** — никаких INT id
7. **Soft delete** — архивировать, не удалять физически
8. **Тесты обязательны** — каждый новый модуль = новый тест
9. **Документируй** необычные решения комментарием в коде
10. **Проверяй зависимости** — не начинай задачу без выполненных prerequisite задач
