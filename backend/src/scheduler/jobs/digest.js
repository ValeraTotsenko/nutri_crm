'use strict'

const { sendMessage } = require('../../bot/index')
const db = require('../../db')

async function sendDigest(items) {
  if (!items || items.length === 0) return

  const today = new Date().toLocaleDateString('uk-UA', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Kyiv',
  })

  // Получаем счётчики активных клиентов
  const statsRes = await db.query(
    `SELECT COUNT(*) AS total FROM clients WHERE status = 'active' AND archived_at IS NULL`
  )
  const activeClients = statsRes.rows[0]?.total || 0

  const lines = [`🌿 *Доброе утро! Сводка на ${today}:*\n`]

  const callItems = items.filter(i => i.type === 'calls')
  if (callItems.length) lines.push(`📞 *${callItems.reduce((s, i) => s + i.items.length, 0)} созвон(а)* запланировано`)

  const deadlineItems = items.filter(i => i.type === 'deadlines')
  if (deadlineItems.length) lines.push(`🔴 *${deadlineItems.reduce((s, i) => s + i.items.length, 0)} дедлайн(а)* задач`)

  const overdueItems = items.filter(i => i.type === 'overdue')
  if (overdueItems.length) lines.push(`⚠️ *${overdueItems.reduce((s, i) => s + i.items.length, 0)} задача* просрочена`)

  const leadItems = items.filter(i => i.type === 'leads')
  if (leadItems.length) lines.push(`👋 *${leadItems.reduce((s, i) => s + i.items.length, 0)} лида* ждут контакта`)

  const courseItems = items.filter(i => i.type === 'courses')
  if (courseItems.length) lines.push(`📅 *${courseItems.reduce((s, i) => s + i.items.length, 0)} курс* заканчивается`)

  lines.push(`\n_Активных клиентов: ${activeClients}_`)

  await sendMessage(lines.join('\n'))
}

module.exports = { sendDigest }
