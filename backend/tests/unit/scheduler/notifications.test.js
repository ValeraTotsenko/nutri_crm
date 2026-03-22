'use strict'

// Мокируем модули ДО импорта тестируемого кода
jest.mock('../../../src/db', () => ({
  query: jest.fn(),
}))

jest.mock('../../../src/bot/index', () => ({
  sendMessage: jest.fn().mockResolvedValue({ message_id: 42 }),
}))

const db = require('../../../src/db')
const { sendMessage } = require('../../../src/bot/index')
const { logAndSend, wasAlreadySentToday } = require('../../../src/scheduler/jobs/notifications.helper')

beforeEach(() => {
  jest.clearAllMocks()
})

describe('wasAlreadySentToday', () => {
  test('возвращает true если запись есть в лоде за сегодня', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] })
    const result = await wasAlreadySentToday('birthday', 'uuid-123')
    expect(result).toBe(true)
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('notifications_log'),
      ['birthday', 'uuid-123']
    )
  })

  test('возвращает false если записей нет', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    const result = await wasAlreadySentToday('birthday', 'uuid-456')
    expect(result).toBe(false)
  })
})

describe('logAndSend', () => {
  test('отправляет сообщение и записывает в лог если не было сегодня', async () => {
    // wasAlreadySentToday → false
    db.query.mockResolvedValueOnce({ rows: [] })
    // INSERT в notifications_log
    db.query.mockResolvedValueOnce({ rows: [] })

    await logAndSend('birthday', 'uuid-123', 'client', 'Тест текст')

    expect(sendMessage).toHaveBeenCalledWith('Тест текст', {})
    expect(db.query).toHaveBeenCalledTimes(2)
  })

  test('НЕ отправляет если уже было сегодня', async () => {
    // wasAlreadySentToday → true
    db.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] })

    await logAndSend('birthday', 'uuid-123', 'client', 'Тест текст')

    expect(sendMessage).not.toHaveBeenCalled()
    expect(db.query).toHaveBeenCalledTimes(1)
  })
})

describe('Birthday notification trigger', () => {
  test('находит клиентов с ДР сегодня', async () => {
    const mockClient = {
      id: 'client-uuid',
      first_name: 'Анна',
      last_name: 'Коваль',
      goal: 'снижение веса',
      work_type: 'individual',
    }

    // getBot уже мокирован через bot/index mock
    db.query
      .mockResolvedValueOnce({ rows: [mockClient] }) // SELECT clients WHERE birthday = today
      .mockResolvedValueOnce({ rows: [] })            // wasAlreadySentToday → false
      .mockResolvedValueOnce({ rows: [] })            // INSERT log

    process.env.WEBAPP_URL = 'https://test.app'
    process.env.NODE_ENV = 'test'

    const { checkBirthdays } = require('../../../src/scheduler/jobs/birthdays')
    const result = await checkBirthdays()

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('client-uuid')
  })
})

describe('Task deadline trigger', () => {
  test('находит задачи с дедлайном через remind_days_before дней', async () => {
    const mockTask = {
      id: 'task-uuid',
      title: 'Составить рацион',
      deadline_date: '2024-03-25',
      remind_days_before: 1,
      first_name: 'Анна',
      last_name: 'Коваль',
    }

    db.query
      .mockResolvedValueOnce({ rows: [mockTask] }) // SELECT tasks
      .mockResolvedValueOnce({ rows: [] })          // wasAlreadySentToday
      .mockResolvedValueOnce({ rows: [] })          // INSERT log

    const { checkTaskDeadlines } = require('../../../src/scheduler/jobs/tasks')
    const result = await checkTaskDeadlines()

    expect(result).toHaveLength(1)
    expect(sendMessage).toHaveBeenCalledWith(
      expect.stringContaining('Дедлайн задачи'),
      expect.any(Object)
    )
  })
})

describe('Payment overdue trigger', () => {
  test('находит просроченные платежи по порогу overdue_days_threshold', async () => {
    const mockPayment = {
      id: 'payment-uuid',
      client_id: 'client-uuid',
      first_name: 'Марина',
      last_name: 'Семко',
      total_amount: 10000,
      paid_amount: 3000,
      remaining_amount: 7000,
      currency: 'UAH',
      next_payment_date: '2024-03-18',
    }

    db.query
      .mockResolvedValueOnce({ rows: [] })            // getUpcomingPayments(2)
      .mockResolvedValueOnce({ rows: [] })            // getTodayPayments
      .mockResolvedValueOnce({ rows: [mockPayment] }) // getOverduePayments

    // logAndSend mocks
    db.query
      .mockResolvedValueOnce({ rows: [] })  // wasAlreadySentToday
      .mockResolvedValueOnce({ rows: [] })  // INSERT log

    const { checkPayments } = require('../../../src/scheduler/jobs/payments')
    await checkPayments()

    expect(sendMessage).toHaveBeenCalledWith(
      expect.stringContaining('не доплатил'),
      expect.any(Object)
    )
  })
})

describe('Lead reminder trigger', () => {
  test('не отправляет уведомление для лидов со статусом refused', async () => {
    // SQL запрос уже фильтрует refused на уровне БД
    // Проверяем что запрос содержит фильтр
    db.query.mockResolvedValueOnce({ rows: [] })

    const { checkLeads } = require('../../../src/scheduler/jobs/leads')
    await checkLeads()

    const callArgs = db.query.mock.calls[0]
    expect(callArgs[0]).toContain("NOT IN ('refused')")
  })
})
