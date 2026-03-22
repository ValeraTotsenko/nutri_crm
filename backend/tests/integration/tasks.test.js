'use strict'

jest.mock('../../src/middleware/auth', () => ({
  validateTelegramInitData: () => true,
}))
jest.mock('../../src/bot/index', () => async (app) => {})
jest.mock('../../src/scheduler', () => ({}))

const request = require('supertest')
const Fastify = require('fastify')

let app
let taskId

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://nutricrm:test@localhost:5432/nutricrm_test'
  process.env.BOT_TOKEN = 'test'
  process.env.OWNER_TELEGRAM_ID = '1'
  process.env.WEBAPP_URL = 'http://localhost'

  app = Fastify({ logger: false })
  app.register(require('@fastify/sensible'))
  app.decorate('authenticate', async () => {})
  app.register(require('../../src/routes/tasks'), { prefix: '/api' })
  app.register(require('../../src/routes/clients'), { prefix: '/api' })
  await app.ready()
})

afterAll(() => app.close())

describe('Tasks CRUD', () => {
  test('GET /api/tasks возвращает массив', async () => {
    const res = await request(app.server).get('/api/tasks').set('X-Telegram-Init-Data', 'mock')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  test('POST /api/tasks создаёт задачу', async () => {
    // Сначала создаём клиента
    const clientRes = await request(app.server)
      .post('/api/clients')
      .set('X-Telegram-Init-Data', 'mock')
      .send({ last_name: 'Тест', first_name: 'Задача', work_type: 'express', start_date: '2024-01-01' })

    const clientId = clientRes.body.id

    const res = await request(app.server)
      .post('/api/tasks')
      .set('X-Telegram-Init-Data', 'mock')
      .send({ client_id: clientId, title: 'Тестовая задача' })

    expect(res.status).toBe(201)
    expect(res.body.title).toBe('Тестовая задача')
    taskId = res.body.id
  })

  test('POST /api/tasks/:id/complete закрывает задачу', async () => {
    if (!taskId) return
    const res = await request(app.server)
      .post(`/api/tasks/${taskId}/complete`)
      .set('X-Telegram-Init-Data', 'mock')

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('done')
    expect(res.body.completed_at).toBeDefined()
  })
})
