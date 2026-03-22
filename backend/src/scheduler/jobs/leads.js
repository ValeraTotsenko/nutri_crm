'use strict'

const db = require('../../db')
const { logAndSend } = require('./notifications.helper')
const config = require('../../config')

async function checkLeads() {
  const result = await db.query(
    `SELECT l.*,
      EXTRACT(DAY FROM NOW() - l.last_contact_at)::int AS days_since_contact
     FROM leads l
     WHERE l.status NOT IN ('refused')
       AND l.converted_to_client_id IS NULL
       AND (CURRENT_DATE - l.last_contact_at::date) >= l.remind_after_days`
  )

  for (const lead of result.rows) {
    const name = `${lead.last_name || ''} ${lead.first_name}`.trim()
    const text = `👋 *Время написать лиду*\n*${name}*\n` +
      `Статус: ${lead.status} · Без контакта: *${lead.days_since_contact} дн.*\n` +
      (lead.interest ? `Интерес: ${lead.interest}` : '')

    await logAndSend('lead_remind', lead.id, 'lead', text, {
      reply_markup: {
        inline_keyboard: [[
          { text: 'Написала ✓', callback_data: `lead_contacted:${lead.id}` },
          { text: 'Карточка', web_app: { url: `${config.webapp.url}/leads/${lead.id}` } },
        ]],
      },
    })
  }

  return result.rows
}

module.exports = { checkLeads }
