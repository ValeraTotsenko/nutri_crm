'use strict'

const callsService = require('../../services/calls.service')
const { logAndSend } = require('./notifications.helper')
const config = require('../../config')

async function checkCallsTomorrow() {
  const calls = await callsService.getCallsTomorrow()
  const notified = []

  for (const call of calls) {
    const time = new Date(call.scheduled_at).toLocaleTimeString('uk-UA', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv',
    })

    const isLead = call.lead_id && !call.client_id
    const name = isLead
      ? `${call.lead_last_name || ''} ${call.lead_first_name || ''}`.trim()
      : `${call.last_name || ''} ${call.first_name || ''}`.trim()

    const type = isLead ? 'diagnostic_tomorrow' : 'call_tomorrow'
    const icon = isLead ? '🔍 *Бесплатная диагностика завтра*' : '📞 *Созвон завтра*'
    const text = `${icon}\n*${name}*\n🕐 Завтра в *${time}*${call.platform ? ` · ${call.platform}` : ''}\n` +
      (isLead ? `Интерес: ${call.interest || '—'}` : `Тип: ${call.call_type}`)

    const entityId = call.lead_id || call.client_id
    const entityPath = isLead ? 'leads' : 'clients'

    await logAndSend(type, entityId, isLead ? 'lead' : 'client', text, {
      reply_markup: {
        inline_keyboard: [[
          { text: 'Карточка', web_app: { url: `${config.webapp.url}/${entityPath}/${entityId}` } },
          { text: 'Отменить', callback_data: `call_cancel:${call.id}` },
        ]],
      },
    })
    notified.push(call)
  }

  return notified
}

module.exports = { checkCallsTomorrow }
