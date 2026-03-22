'use strict'

jest.mock('../../src/middleware/auth', () => ({ validateTelegramInitData: () => true }))
jest.mock('../../src/bot/index', () => async (app) => {})
jest.mock('../../src/scheduler', () => ({}))

const request = require('supertest')
const Fastify = require('fastify')

let app, clientId, callId

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://nutricrm:test@localhost:5432/nutricrm_test'
  process.env.BOT_TOKEN = 'test'
  process.env.OWNER_TELEGRAM_ID = '1'
  process.env.WEBAPP_URL = 'http://localhost'

  app = Fastify({ logger: false })
  app.register(require('@fastify/sensible'))
  app.decorate('authenticate', async () => {})
  app.register(require('../../src/routes/clients'), { prefix: '/api' })
  app.register(require('../../src/routes/calls'), { prefix: '/api' })
  await app.ready()

  const res = await request(app.server)
    .post('/api/clients')
    .set('X-Telegram-Init-Data', 'mock')
    .send({ last_name: 'Созвон', first_name: 'Тест', work_type: 'individual', start_date: '2024-01-01' })
  clientId = res.body.id
})

afterAll(() => app.close())

describe('Calls CRUD', () => {
  test('создаёт созвон', async () => {
    const res = await request(app.server)
      .post('/api/calls')
      .set('X-Telegram-Init-Data', 'mock')
      .send({
        client_id: clientId,
        scheduled_at: '2024-03-01T15:00:00+02:00',
        call_type: 'intro',
        platform: 'Zoom',
      })

    expect(res.status).toBe(201)
    expect(res.body.call_type).toBe('intro')
    callId = res.body.id
  })

  test('возвращает 400 без client_id и lead_id', async () => {
    const res = await request(app.server)
      .post('/api/calls')
      .set('X-Telegram-Init-Data', 'mock')
      .send({ scheduled_at: '2024-03-01T15:00:00', call_type: 'intro' })

    expect(res.status).toBe(400)
  })

  test('обновляет статус созвона', async () => {
    if (!callId) return
    const res = await request(app.server)
      .patch(`/api/calls/${callId}`)
      .set('X-Telegram-Init-Data', 'mock')
      .send({ status: 'done' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('done')
  })
})
