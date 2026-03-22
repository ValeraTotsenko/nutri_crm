'use strict'

jest.mock('../../../src/db', () => ({
  query: jest.fn(),
}))

const db = require('../../../src/db')

// Тестируем логику определения просрочки
describe('Payment overdue logic', () => {
  test('оверлимит определяется корректно', () => {
    const isOverdue = (payment, today) => {
      const diff = Math.floor((today - new Date(payment.next_payment_date)) / 86400000)
      return diff === payment.overdue_days_threshold
    }

    expect(isOverdue(
      { next_payment_date: '2024-01-01', overdue_days_threshold: 2 },
      new Date('2024-01-03')
    )).toBe(true)

    expect(isOverdue(
      { next_payment_date: '2024-01-01', overdue_days_threshold: 2 },
      new Date('2024-01-02')
    )).toBe(false)

    expect(isOverdue(
      { next_payment_date: '2024-01-01', overdue_days_threshold: 7 },
      new Date('2024-01-08')
    )).toBe(true)
  })
})

describe('PaymentsService.findByClientId', () => {
  test('возвращает платежи клиента', async () => {
    const mockPayments = [
      { id: 'p1', client_id: 'c1', total_amount: '10000', paid_amount: '5000' },
    ]
    db.query.mockResolvedValueOnce({ rows: mockPayments })

    const paymentsService = require('../../../src/services/payments.service')
    const result = await paymentsService.findByClientId('c1')

    expect(result).toEqual(mockPayments)
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('payments_with_totals'),
      ['c1']
    )
  })
})
