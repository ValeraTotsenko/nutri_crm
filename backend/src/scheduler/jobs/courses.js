'use strict'

const db = require('../../db')
const { logAndSend } = require('./notifications.helper')
const config = require('../../config')

async function checkCourseEnds() {
  const result = await db.query(
    `SELECT * FROM clients
     WHERE archived_at IS NULL
       AND end_date IS NOT NULL
       AND end_date - CURRENT_DATE = 7
       AND status NOT IN ('completed')`
  )

  for (const client of result.rows) {
    const text = `📅 *Курс заканчивается через 7 дней*\n*${client.last_name} ${client.first_name}*\n` +
      `📅 Окончание: *${client.end_date}*\nНапомните клиенту о продлении`

    await logAndSend('course_ending', client.id, 'client', text, {
      reply_markup: {
        inline_keyboard: [[
          { text: 'Карточка', web_app: { url: `${config.webapp.url}/clients/${client.id}` } },
          { text: 'Продлить', web_app: { url: `${config.webapp.url}/clients/${client.id}` } },
        ]],
      },
    })
  }

  return result.rows
}

module.exports = { checkCourseEnds }
