'use strict'

jest.mock('../../src/middleware/auth', () => ({ validateTelegramInitData: () => true }))
jest.mock('../../src/bot/index', () => async (app) => {})
jest.mock('../../src/scheduler', () => ({}))

const request = require('supertest')
const Fastify = require('fastify')

let app, clientId, paymentId

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
  app.register(require('../../src/routes/payments'), { prefix: '/api' })
  await app.ready()

  // Создаём тестового клиента
  const res = await request(app.server)
    .post('/api/clients')
    .set('X-Telegram-Init-Data', 'mock')
    .send({ last_name: 'Платёж', first_name: 'Тест', work_type: 'individual', start_date: '2024-01-01' })
  clientId = res.body.id
})

afterAll(() => app.close())

describe('Payments flow', () => {
  test('создаёт договор оплаты', async () => {
    const res = await request(app.server)
      .post(`/api/clients/${clientId}/payments`)
      .set('X-Telegram-Init-Data', 'mock')
      .send({ total_amount: 10000, next_payment_date: '2024-02-01' })

    expect(res.status).toBe(201)
    expect(parseFloat(res.body.total_amount)).toBe(10000)
    paymentId = res.body.id
  })

  test('вносит транзакцию (частичная оплата)', async () => {
    if (!paymentId) return
    const res = await request(app.server)
      .post(`/api/payments/${paymentId}/transactions`)
      .set('X-Telegram-Init-Data', 'mock')
      .send({ amount: 5000, paid_at: '2024-01-15', method: 'Monobank' })

    expect(res.status).toBe(201)
    expect(parseFloat(res.body.amount)).toBe(5000)
  })

  test('paid_amount обновляется после транзакции', async () => {
    if (!paymentId) return
    const res = await request(app.server)
      .get(`/api/clients/${clientId}/payments`)
      .set('X-Telegram-Init-Data', 'mock')

    const payment = res.body.find(p => p.id === paymentId)
    expect(parseFloat(payment.paid_amount)).toBe(5000)
    expect(parseFloat(payment.remaining_amount)).toBe(5000)
    expect(payment.is_paid_in_full).toBe(false)
  })
})
