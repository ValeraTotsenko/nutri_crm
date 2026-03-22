'use strict'

const db = require('../db')

class PaymentsService {
  async findByClientId(clientId) {
    const result = await db.query(
      `SELECT * FROM payments_with_totals WHERE client_id = $1 ORDER BY created_at DESC`,
      [clientId]
    )
    return result.rows
  }

  async findById(id) {
    const result = await db.query(
      `SELECT * FROM payments_with_totals WHERE id = $1`,
      [id]
    )
    return result.rows[0] || null
  }

  async create(clientId, data) {
    const { total_amount, next_payment_date, overdue_days_threshold = 2, currency = 'UAH', notes } = data
    const result = await db.query(
      `INSERT INTO payments (client_id, total_amount, next_payment_date, overdue_days_threshold, currency, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [clientId, total_amount, next_payment_date || null, overdue_days_threshold, currency, notes || null]
    )
    return result.rows[0]
  }

  async update(id, data) {
    const allowed = ['next_payment_date','overdue_days_threshold','currency','notes','total_amount']
    const updates = []
    const params = []
    let idx = 1

    for (const key of allowed) {
      if (key in data) {
        updates.push(`${key} = $${idx}`)
        params.push(data[key])
        idx++
      }
    }
    if (updates.length === 0) throw new Error('No fields to update')

    params.push(id)
    const result = await db.query(
      `UPDATE payments SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      params
    )
    return result.rows[0] || null
  }

  async addTransaction(paymentId, data) {
    const { amount, paid_at, method, note } = data
    const result = await db.query(
      `INSERT INTO payment_transactions (payment_id, amount, paid_at, method, note)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [paymentId, amount, paid_at, method || null, note || null]
    )
    return result.rows[0]
  }

  async getTransactions(paymentId) {
    const result = await db.query(
      `SELECT * FROM payment_transactions WHERE payment_id = $1 ORDER BY paid_at DESC`,
      [paymentId]
    )
    return result.rows
  }

  // Для планировщика: клиенты с предстоящими и просроченными платежами
  async getUpcomingPayments(daysAhead = 2) {
    const result = await db.query(
      `SELECT pwt.*, c.first_name, c.last_name, c.telegram_username
       FROM payments_with_totals pwt
       JOIN clients c ON c.id = pwt.client_id
       WHERE pwt.next_payment_date IS NOT NULL
         AND pwt.is_paid_in_full = false
         AND pwt.next_payment_date = CURRENT_DATE + $1
         AND c.archived_at IS NULL`,
      [daysAhead]
    )
    return result.rows
  }

  async getOverduePayments() {
    const result = await db.query(
      `SELECT pwt.*, c.first_name, c.last_name
       FROM payments_with_totals pwt
       JOIN clients c ON c.id = pwt.client_id
       WHERE pwt.next_payment_date IS NOT NULL
         AND pwt.is_paid_in_full = false
         AND (CURRENT_DATE - pwt.next_payment_date) = pwt.overdue_days_threshold
         AND c.archived_at IS NULL`
    )
    return result.rows
  }

  async getTodayPayments() {
    const result = await db.query(
      `SELECT pwt.*, c.first_name, c.last_name
       FROM payments_with_totals pwt
       JOIN clients c ON c.id = pwt.client_id
       WHERE pwt.next_payment_date = CURRENT_DATE
         AND pwt.is_paid_in_full = false
         AND c.archived_at IS NULL`
    )
    return result.rows
  }
}

module.exports = new PaymentsService()
