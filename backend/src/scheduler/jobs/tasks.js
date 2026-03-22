'use strict'

const tasksService = require('../../services/tasks.service')
const { logAndSend } = require('./notifications.helper')
const config = require('../../config')

async function checkTaskDeadlines() {
  const tasks = await tasksService.getUpcomingDeadlines()
  for (const task of tasks) {
    const text = `🔴 *Дедлайн задачи*\n*${task.last_name} ${task.first_name}*\n` +
      `📋 ${task.title}\n📅 Дедлайн: *${task.deadline_date}*`

    await logAndSend('task_deadline', task.id, 'task', text, {
      reply_markup: {
        inline_keyboard: [[
          { text: 'Открыть', web_app: { url: `${config.webapp.url}/tasks` } },
          { text: 'Выполнено ✓', callback_data: `task_done:${task.id}` },
        ]],
      },
    })
  }
  return tasks
}

async function checkOverdueTasks() {
  const tasks = await tasksService.getOverdueTasks()
  for (const task of tasks) {
    const text = `⚠️ *Задача просрочена*\n*${task.last_name} ${task.first_name}*\n` +
      `📋 ${task.title}\n📅 Просрочено на *${task.overdue_days} дн.*`

    await logAndSend('task_overdue', task.id, 'task', text, {
      reply_markup: {
        inline_keyboard: [[
          { text: 'Открыть', web_app: { url: `${config.webapp.url}/tasks` } },
          { text: 'Закрыть', callback_data: `task_done:${task.id}` },
        ]],
      },
    })
  }
  return tasks
}

module.exports = { checkTaskDeadlines, checkOverdueTasks }
