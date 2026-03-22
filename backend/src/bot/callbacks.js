'use strict'

const leadsService = require('../services/leads.service')
const tasksService = require('../services/tasks.service')

module.exports = async function handleCallbackQuery(query) {
  const bot = require('./index').getBot()
  const [action, entityId] = (query.data || '').split(':')

  try {
    switch (action) {
      case 'lead_contacted': {
        await leadsService.markContacted(entityId)
        await bot.answerCallbackQuery(query.id, { text: '✓ Контакт отмечен' })
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: query.message.chat.id, message_id: query.message.message_id }
        )
        break
      }
      case 'task_done': {
        await tasksService.complete(entityId)
        await bot.answerCallbackQuery(query.id, { text: '✓ Задача закрыта' })
        break
      }
      default:
        await bot.answerCallbackQuery(query.id)
    }
  } catch (err) {
    console.error('Callback error:', err)
    await bot.answerCallbackQuery(query.id, { text: '❌ Ошибка' })
  }
}
