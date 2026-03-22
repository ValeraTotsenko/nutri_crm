'use strict'

const cron = require('node-cron')
const config = require('../config')

if (process.env.NODE_ENV === 'test') {
  module.exports = {}
  return
}

const { runDailyJobs } = require('./jobs/daily')
const { checkBirthdays } = require('./jobs/birthdays')

const TZ = config.notifications.timezone
const HOUR = config.notifications.hour

console.log(`Scheduler: Пн-Пт ${HOUR}:00 ${TZ} + ДР каждый день`)

// Рабочие дни: весь дневной комплекс
cron.schedule(`0 ${HOUR} * * 1-5`, runDailyJobs, { timezone: TZ })

// ДР — каждый день (в т.ч. выходные)
cron.schedule(`0 ${HOUR} * * *`, checkBirthdays, { timezone: TZ })

module.exports = {}
