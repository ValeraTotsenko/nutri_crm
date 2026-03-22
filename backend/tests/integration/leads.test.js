'use strict'

jest.mock('../../src/middleware/auth', () => ({
  validateTelegramInitData: () => true,
  validateTelegramInitDataStrict: () => true,
}))
jest.mock('../../src/bot/index', () => async (app) => {})
jest.mock('../../src/scheduler', () => ({}))

const request = require('supertest')
const Fastify = require('fastify')

let app

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://nutricrm:test@localhost:5432/nutricrm_test'
  process.env.BOT_TOKEN = 'test_token'
  process.env.OWNER_TELEGRAM_ID = '123456789'
  process.env.WEBAPP_URL = 'http://localhost:5173'

  app = Fastify({ logger: false })
  app.register(require('@fastify/sensible'))
  app.decorate('authenticate', async (req) => { req.telegramUser = { id: 123456789 } })
  app.register(require('../../src/routes/leads'), { prefix: '/api' })
  await app.ready()
})

afterAll(() => app.close())

let createdLeadId

describe('POST /api/leads', () => {
  test('создаёт лида', async () => {
    const res = await request(app.server)
      .post('/api/leads')
      .set('X-Telegram-Init-Data', 'mock')
      .send({
        first_name: 'Ольга',
        last_name: 'Тестова',
        source: 'Jest test',
      })

    expect(res.status).toBe(201)
    expect(res.body.first_name).toBe('Ольга')
    createdLeadId = res.body.id
  })

  test('возвращает 400 без first_name', async () => {
    const res = await request(app.server)
      .post('/api/leads')
      .set('X-Telegram-Init-Data', 'mock')
      .send({ last_name: 'Только фамилия' })

    expect(res.status).toBe(400)
  })
})

describe('POST /api/leads/:id/contact', () => {
  test('обновляет last_contact_at', async () => {
    if (!createdLeadId) return
    const res = await request(app.server)
      .post(`/api/leads/${createdLeadId}/contact`)
      .set('X-Telegram-Init-Data', 'mock')

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(createdLeadId)
  })
})
