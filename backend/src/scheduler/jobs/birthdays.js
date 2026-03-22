'use strict'

const db = require('../../db')
const { logAndSend } = require('./notifications.helper')
const config = require('../../config')

async function checkBirthdays() {
  const result = await db.query(
    `SELECT * FROM clients
     WHERE archived_at IS NULL
       AND birth_date IS NOT NULL
       AND EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(DAY FROM birth_date) = EXTRACT(DAY FROM CURRENT_DATE)`
  )

  for (const client of result.rows) {
    const text = `🎂 *День рождения!*\nСегодня день рождения *${client.last_name} ${client.first_name}*\n` +
      `🎯 Цель: ${client.goal || '—'}\n_Не забудьте поздравить ✨_`

    await logAndSend('birthday', client.id, 'client', text, {
      reply_markup: {
        inline_keyboard: [[
          { text: 'Открыть карточку', web_app: { url: `${config.webapp.url}/clients/${client.id}` } },
        ]],
      },
    })
  }

  return result.rows
}

module.exports = { checkBirthdays }
