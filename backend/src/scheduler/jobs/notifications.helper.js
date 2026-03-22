'use strict'

const db = require('../../db')
const { sendMessage } = require('../../bot/index')

async function wasAlreadySentToday(type, entityId) {
  const result = await db.query(
    `SELECT 1 FROM notifications_log
     WHERE type = $1 AND entity_id = $2
       AND sent_at::date = CURRENT_DATE
     LIMIT 1`,
    [type, entityId]
  )
  return result.rows.length > 0
}

async function logAndSend(type, entityId, entityType, text, opts = {}) {
  if (await wasAlreadySentToday(type, entityId)) return null

  try {
    const msg = await sendMessage(text, opts)
    await db.query(
      `INSERT INTO notifications_log (type, entity_id, entity_type, message_text, tg_message_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [type, entityId, entityType, text, msg?.message_id || null]
    )
    return msg
  } catch (err) {
    console.error(`Failed to send notification [${type}]:`, err.message)
    return null
  }
}

module.exports = { wasAlreadySentToday, logAndSend }
