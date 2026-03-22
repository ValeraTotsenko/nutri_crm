'use strict'

require('dotenv').config()
const Fastify = require('fastify')
const config = require('./config')
const db = require('./db')

const app = Fastify({
  logger: {
    level: config.server.nodeEnv === 'production' ? 'warn' : 'info',
  },
})

// Plugins
app.register(require('@fastify/cors'), {
  origin: config.webapp.url,
  credentials: true,
})
app.register(require('@fastify/sensible'))

// Auth decorator
const { validateTelegramInitData } = require('./middleware/auth')
app.decorate('authenticate', async function (request, reply) {
  const initData = request.headers['x-telegram-init-data']
  if (!initData) {
    return reply.code(401).send({ error: 'Missing Telegram auth data' })
  }
  const isValid = validateTelegramInitData(initData, config.bot.token)
  if (!isValid) {
    return reply.code(401).send({ error: 'Invalid Telegram auth data' })
  }
  // Проверяем что это наш владелец
  try {
    const params = new URLSearchParams(initData)
    const user = JSON.parse(params.get('user') || '{}')
    if (user.id !== config.bot.ownerTelegramId) {
      return reply.code(403).send({ error: 'Access denied' })
    }
    request.telegramUser = user
  } catch {
    return reply.code(401).send({ error: 'Invalid user data' })
  }
})

// Health check (без auth)
app.get('/health', async () => {
  const dbTime = await db.healthCheck()
  return { status: 'ok', db: 'connected', time: dbTime }
})

// Routes
app.register(require('./routes/clients'), { prefix: '/api' })
app.register(require('./routes/leads'), { prefix: '/api' })
app.register(require('./routes/payments'), { prefix: '/api' })
app.register(require('./routes/tasks'), { prefix: '/api' })
app.register(require('./routes/calls'), { prefix: '/api' })

// Bot webhook route (будет зарегистрирован ботом)
app.register(require('./bot'), { prefix: '/bot' })

// Start
async function start() {
  try {
    // Запускаем миграции
    const { migrate } = require('./db/migrate')
    await migrate()

    await app.listen({ port: config.server.port, host: '0.0.0.0' })
    app.log.info(`Server listening on port ${config.server.port}`)

    // Запускаем scheduler
    require('./scheduler')
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()

module.exports = app
