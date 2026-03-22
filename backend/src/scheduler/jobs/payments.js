'use strict'

const paymentsService = require('../../services/payments.service')
const { logAndSend } = require('./notifications.helper')
const config = require('../../config')

async function checkPayments() {
  const items = []

  // Платёж послезавтра
  const upcoming = await paymentsService.getUpcomingPayments(2)
  for (const p of upcoming) {
    const text = `💳 *Платёж послезавтра*\n*${p.last_name} ${p.first_name}*\n` +
      `💰 Оплачено: ${p.paid_amount} из ${p.total_amount} ${p.currency}\n📅 Дата: ${p.next_payment_date}`
    await logAndSend('payment_upcoming', p.id, 'payment', text, {
      reply_markup: { inline_keyboard: [[
        { text: 'Карточка', web_app: { url: `${config.webapp.url}/clients/${p.client_id}` } },
      ]]},
    })
    items.push({ type: 'payment_upcoming', item: p })
  }

  // Платёж сегодня
  const today = await paymentsService.getTodayPayments()
  for (const p of today) {
    const text = `💰 *Сегодня ожидается платёж*\n*${p.last_name} ${p.first_name}*\n` +
      `💵 Остаток: *${p.remaining_amount} ${p.currency}*`
    await logAndSend('payment_today', p.id, 'payment', text, {
      reply_markup: { inline_keyboard: [[
        { text: 'Внести оплату', web_app: { url: `${config.webapp.url}/clients/${p.client_id}` } },
      ]]},
    })
    items.push({ type: 'payment_today', item: p })
  }

  // Просрочка
  const overdue = await paymentsService.getOverduePayments()
  for (const p of overdue) {
    const text = `💸 *Клиент не доплатил*\n*${p.last_name} ${p.first_name}*\n` +
      `Долг: *${p.remaining_amount} ${p.currency}*\n📅 Дедлайн был: ${p.next_payment_date}`
    await logAndSend('payment_overdue', p.id, 'payment', text)
    items.push({ type: 'payment_overdue', item: p })
  }

  return { items }
}

module.exports = { checkPayments }
