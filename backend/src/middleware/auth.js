'use strict'

const crypto = require('crypto')

/**
 * Валидация Telegram initData по HMAC-SHA256
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function validateTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return false

  try {
    const urlParams = new URLSearchParams(initData)
    const hash = urlParams.get('hash')
    if (!hash) return false

    urlParams.delete('hash')

    const dataCheckString = [...urlParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest()

    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex')

    return expectedHash === hash
  } catch {
    return false
  }
}

/**
 * В dev/test режиме — пропускаем проверку
 */
function validateTelegramInitDataAllowDev(initData, botToken) {
  if (process.env.NODE_ENV === 'test') return true
  if (process.env.NODE_ENV === 'development' && initData === 'dev_bypass') return true
  return validateTelegramInitData(initData, botToken)
}

module.exports = {
  validateTelegramInitData: validateTelegramInitDataAllowDev,
  validateTelegramInitDataStrict: validateTelegramInitData,
}
