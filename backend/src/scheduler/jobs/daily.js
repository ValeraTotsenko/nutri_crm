'use strict'

const { checkCallsTomorrow } = require('./calls')
const { checkTaskDeadlines, checkOverdueTasks } = require('./tasks')
const { checkPayments } = require('./payments')
const { checkLeads } = require('./leads')
const { checkCourseEnds } = require('./courses')
const { sendDigest } = require('./digest')
const tasksService = require('../../services/tasks.service')

async function runDailyJobs() {
  console.log('Scheduler: запуск ежедневных задач', new Date().toISOString())
  try {
    // Сначала обновляем статусы просроченных задач
    await tasksService.markOverdue()

    const digestItems = []

    const results = await Promise.allSettled([
      checkCallsTomorrow().then(r => { if (r?.length) digestItems.push({ type: 'calls', items: r }) }),
      checkTaskDeadlines().then(r => { if (r?.length) digestItems.push({ type: 'deadlines', items: r }) }),
      checkOverdueTasks().then(r => { if (r?.length) digestItems.push({ type: 'overdue', items: r }) }),
      checkPayments().then(r => { if (r) digestItems.push(...(r.items || [])) }),
      checkLeads().then(r => { if (r?.length) digestItems.push({ type: 'leads', items: r }) }),
      checkCourseEnds().then(r => { if (r?.length) digestItems.push({ type: 'courses', items: r }) }),
    ])

    // Логируем ошибки
    results.forEach((r, i) => {
      if (r.status === 'rejected') console.error(`Job ${i} failed:`, r.reason)
    })

    if (digestItems.length > 0) {
      await sendDigest(digestItems)
    }
  } catch (err) {
    console.error('Daily jobs error:', err)
  }
}

module.exports = { runDailyJobs }
