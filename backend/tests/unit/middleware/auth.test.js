'use strict'

const crypto = require('crypto')

// Импортируем только строгую версию (без dev bypass)
const { validateTelegramInitDataStrict } = require('../../../src/middleware/auth')

function buildInitData(params, botToken) {
  const sorted = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hash = crypto.createHmac('sha256', secretKey).update(sorted).digest('hex')

  const urlParams = new URLSearchParams(params)
  urlParams.set('hash', hash)
  return urlParams.toString()
}

describe('validateTelegramInitData', () => {
  const BOT_TOKEN = 'test_bot_token_12345'

  test('принимает корректный initData', () => {
    const initData = buildInitData(
      { user: '{"id":123}', auth_date: '1700000000' },
      BOT_TOKEN
    )
    expect(validateTelegramInitDataStrict(initData, BOT_TOKEN)).toBe(true)
  })

  test('отклоняет неверный hash', () => {
    const initData = buildInitData(
      { user: '{"id":123}', auth_date: '1700000000' },
      BOT_TOKEN
    )
    const tampered = initData.replace(/hash=[^&]+/, 'hash=000000')
    expect(validateTelegramInitDataStrict(tampered, BOT_TOKEN)).toBe(false)
  })

  test('отклоняет initData без hash', () => {
    expect(validateTelegramInitDataStrict('user=%7B%22id%22%3A123%7D', BOT_TOKEN)).toBe(false)
  })

  test('отклоняет пустую строку', () => {
    expect(validateTelegramInitDataStrict('', BOT_TOKEN)).toBe(false)
  })

  test('отклоняет null', () => {
    expect(validateTelegramInitDataStrict(null, BOT_TOKEN)).toBe(false)
  })

  test('отклоняет при неверном botToken', () => {
    const initData = buildInitData(
      { user: '{"id":123}', auth_date: '1700000000' },
      BOT_TOKEN
    )
    expect(validateTelegramInitDataStrict(initData, 'wrong_token')).toBe(false)
  })
})
