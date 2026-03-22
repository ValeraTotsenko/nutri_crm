'use strict'
require('dotenv').config()

const required = ['DATABASE_URL', 'BOT_TOKEN', 'OWNER_TELEGRAM_ID']
const missing = required.filter(k => !process.env[k])
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}`)
  process.exit(1)
}

module.exports = {
  db: {
    connectionString: process.env.DATABASE_URL,
  },
  bot: {
    token: process.env.BOT_TOKEN,
    ownerTelegramId: parseInt(process.env.OWNER_TELEGRAM_ID, 10),
    webhookUrl: process.env.WEBAPP_URL ? `${process.env.WEBAPP_URL}/bot/webhook` : null,
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  notifications: {
    hour: parseInt(process.env.NOTIFICATIONS_HOUR || '10', 10),
    timezone: process.env.NOTIFICATIONS_TZ || 'Europe/Kyiv',
  },
  webapp: {
    url: process.env.WEBAPP_URL || 'http://localhost:5173',
  },
}
