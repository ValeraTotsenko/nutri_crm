'use strict'

const db = require('../db')

class ClientsService {
  async findAll({ search, workType, status, sort = 'created_at', order = 'DESC' } = {}) {
    const conditions = ['c.archived_at IS NULL']
    const params = []
    let idx = 1

    if (search) {
      conditions.push(`(c.first_name ILIKE $${idx} OR c.last_name ILIKE $${idx})`)
      params.push(`%${search}%`)
      idx++
    }
    if (workType) {
      conditions.push(`c.work_type = $${idx}`)
      params.push(workType)
      idx++
    }
    if (status) {
      conditions.push(`c.status = $${idx}`)
      params.push(status)
      idx++
    }

    const validSorts = { created_at: 'c.created_at', name: 'c.last_name', birth_date: 'c.birth_date', end_date: 'c.end_date' }
    const sortCol = validSorts[sort] || 'c.created_at'
    const sortOrder = order === 'ASC' ? 'ASC' : 'DESC'

    const sql = `
      SELECT
        c.*,
        COALESCE(pwt.paid_amount, 0) AS paid_amount,
        pwt.total_amount,
        pwt.next_payment_date,
        (SELECT scheduled_at FROM calls WHERE client_id = c.id AND status = 'scheduled' ORDER BY scheduled_at ASC LIMIT 1) AS next_call_at,
        (SELECT COUNT(*) FROM tasks WHERE client_id = c.id AND status NOT IN ('done')) AS open_tasks_count
      FROM clients c
      LEFT JOIN LATERAL (
        SELECT paid_amount, total_amount, next_payment_date
        FROM payments_with_totals
        WHERE client_id = c.id
        ORDER BY created_at DESC LIMIT 1
      ) pwt ON true
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${sortCol} ${sortOrder}
    `
    const result = await db.query(sql, params)
    return result.rows
  }

  async findById(id) {
    const clientResult = await db.query(
      `SELECT c.*, l.first_name AS lead_first_name, l.last_name AS lead_last_name
       FROM clients c
       LEFT JOIN leads l ON l.id = c.source_lead_id
       WHERE c.id = $1 AND c.archived_at IS NULL`,
      [id]
    )
    if (!clientResult.rows[0]) return null

    const client = clientResult.rows[0]

    // Загружаем связанные данные
    const [paymentsRes, tasksRes, callsRes] = await Promise.all([
      db.query(
        `SELECT * FROM payments_with_totals WHERE client_id = $1 ORDER BY created_at DESC`,
        [id]
      ),
      db.query(
        `SELECT * FROM tasks WHERE client_id = $1 ORDER BY CASE status WHEN 'overdue' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END, deadline_date ASC NULLS LAST`,
        [id]
      ),
      db.query(
        `SELECT * FROM calls WHERE client_id = $1 ORDER BY scheduled_at DESC`,
        [id]
      ),
    ])

    return {
      ...client,
      payments: paymentsRes.rows,
      tasks: tasksRes.rows,
      calls: callsRes.rows,
    }
  }

  async create(data) {
    const {
      last_name, first_name, birth_date, phone, telegram_username,
      work_type, goal, start_date, end_date, status = 'active',
      contraindications, notes, source_lead_id,
    } = data

    const result = await db.query(
      `INSERT INTO clients
        (last_name, first_name, birth_date, phone, telegram_username, work_type, goal, start_date, end_date, status, contraindications, notes, source_lead_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [last_name, first_name, birth_date || null, phone || null, telegram_username || null,
       work_type, goal || null, start_date, end_date || null, status,
       contraindications || null, notes || null, source_lead_id || null]
    )
    return result.rows[0]
  }

  async update(id, data) {
    const allowed = ['last_name','first_name','birth_date','phone','telegram_username',
      'work_type','goal','start_date','end_date','status','contraindications','notes']
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
      `UPDATE clients SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} AND archived_at IS NULL RETURNING *`,
      params
    )
    return result.rows[0] || null
  }

  async archive(id) {
    const result = await db.query(
      `UPDATE clients SET archived_at = NOW() WHERE id = $1 AND archived_at IS NULL RETURNING id`,
      [id]
    )
    return result.rows[0] || null
  }
}

module.exports = new ClientsService()
