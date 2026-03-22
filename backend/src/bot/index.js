'use strict'

const TelegramBot = require('node-telegram-bot-api')
const config = require('../config')

let bot = null

function getBot() {
  if (!bot) {
    bot = new TelegramBot(config.bot.token, {
      polling: config.server.nodeEnv !== 'production',
    })

    bot.on('message', async (msg) => {
      if (msg.text === '/start') {
        const chatId = msg.chat.id
        if (chatId === config.bot.ownerTelegramId) {
          await bot.sendMessage(chatId,
            '✅ *NutriBot CRM подключён*\n\nОткрой Mini App через кнопку ниже.',
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [[
                  { text: '📱 Открыть CRM', web_app: { url: config.webapp.url } },
                ]],
              },
            }
          )
        }
      }
    })

    // Callback query handler для кнопок уведомлений
    bot.on('callback_query', require('./callbacks'))
  }
  return bot
}

async function sendMessage(text, opts = {}) {
  const b = getBot()
  return b.sendMessage(config.bot.ownerTelegramId, text, {
    parse_mode: 'Markdown',
    ...opts,
  })
}

// Fastify plugin для webhook
async function botPlugin(app) {
  if (config.server.nodeEnv === 'production' && config.bot.webhookUrl) {
    const b = getBot()
    await b.setWebHook(config.bot.webhookUrl)

    app.post('/webhook', async (req, reply) => {
      b.processUpdate(req.body)
      return reply.code(200).send({ ok: true })
    })
  }
}

// Инициализируем бота при импорте
getBot()

module.exports = botPlugin
module.exports.sendMessage = sendMessage
module.exports.getBot = getBot
