'use strict'

// Integration тесты требуют реальную тестовую БД
// Запускать с: DATABASE_URL=... npm run test:integration

const request = require('supertest')
const Fastify = require('fastify')

// Мокируем auth для тестов
jest.mock('../../src/middleware/auth', () => ({
  validateTelegramInitData: () => true,
  validateTelegramInitDataStrict: () => true,
}))

// Мокируем бот и scheduler
jest.mock('../../src/bot/index', () => async (app) => {})
jest.mock('../../src/scheduler', () => ({}))

let app

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://nutricrm:test@localhost:5432/nutricrm_test'
  process.env.BOT_TOKEN = 'test_token'
  process.env.OWNER_TELEGRAM_ID = '123456789'
  process.env.WEBAPP_URL = 'http://localhost:5173'

  app = Fastify({ logger: false })
  app.register(require('@fastify/sensible'))
  app.decorate('authenticate', async (req) => {
    req.telegramUser = { id: 123456789 }
  })
  app.register(require('../../src/routes/clients'), { prefix: '/api' })

  await app.ready()
})

afterAll(async () => {
  await app.close()
})

describe('GET /api/clients', () => {
  test('возвращает массив', async () => {
    const res = await request(app.server)
      .get('/api/clients')
      .set('X-Telegram-Init-Data', 'mock')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe('POST /api/clients', () => {
  test('создаёт клиента с обязательными полями', async () => {
    const res = await request(app.server)
      .post('/api/clients')
      .set('X-Telegram-Init-Data', 'mock')
      .send({
        last_name: 'Тест',
        first_name: 'Интеграция',
        work_type: 'individual',
        start_date: '2024-01-01',
      })

    expect(res.status).toBe(201)
    expect(res.body.first_name).toBe('Интеграция')
    expect(res.body.id).toBeDefined()
  })

  test('возвращает 400 без обязательных полей', async () => {
    const res = await request(app.server)
      .post('/api/clients')
      .set('X-Telegram-Init-Data', 'mock')
      .send({ first_name: 'Без фамилии' })

    expect(res.status).toBe(400)
  })
})
