'use strict'

const db = require('../db')

class TasksService {
  async findAll({ clientId, status, overdue } = {}) {
    const conditions = []
    const params = []
    let idx = 1

    if (clientId) {
      conditions.push(`client_id = $${idx}`)
      params.push(clientId)
      idx++
    }
    if (status) {
      conditions.push(`status = $${idx}`)
      params.push(status)
      idx++
    }
    if (overdue) {
      conditions.push(`status = 'overdue'`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const result = await db.query(
      `SELECT t.*, c.first_name, c.last_name
       FROM tasks t
       JOIN clients c ON c.id = t.client_id
       ${where}
       ORDER BY
         CASE t.status WHEN 'overdue' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END,
         t.deadline_date ASC NULLS LAST`,
      params
    )
    return result.rows
  }

  async create(data) {
    const { client_id, title, deadline_date, remind_days_before = 1, status = 'pending', priority = 'medium', notes } = data
    const result = await db.query(
      `INSERT INTO tasks (client_id, title, deadline_date, remind_days_before, status, priority, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [client_id, title, deadline_date || null, remind_days_before, status, priority, notes || null]
    )
    return result.rows[0]
  }

  async update(id, data) {
    const allowed = ['title','deadline_date','remind_days_before','status','priority','notes']
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
      `UPDATE tasks SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      params
    )
    return result.rows[0] || null
  }

  async complete(id) {
    const result = await db.query(
      `UPDATE tasks SET status = 'done', completed_at = NOW(), updated_at = NOW() WHERE id = $1 AND status != 'done' RETURNING *`,
      [id]
    )
    return result.rows[0] || null
  }

  // Для планировщика
  async getUpcomingDeadlines() {
    const result = await db.query(
      `SELECT t.*, c.first_name, c.last_name
       FROM tasks t
       JOIN clients c ON c.id = t.client_id
       WHERE t.status NOT IN ('done')
         AND t.deadline_date IS NOT NULL
         AND t.deadline_date - CURRENT_DATE = t.remind_days_before
         AND c.archived_at IS NULL`
    )
    return result.rows
  }

  async getOverdueTasks() {
    const result = await db.query(
      `SELECT t.*, c.first_name, c.last_name,
        (CURRENT_DATE - t.deadline_date) AS overdue_days
       FROM tasks t
       JOIN clients c ON c.id = t.client_id
       WHERE t.status NOT IN ('done')
         AND t.deadline_date IS NOT NULL
         AND t.deadline_date < CURRENT_DATE
         AND c.archived_at IS NULL`
    )
    return result.rows
  }

  async markOverdue() {
    await db.query(
      `UPDATE tasks SET status = 'overdue', updated_at = NOW()
       WHERE status IN ('pending','in_progress')
         AND deadline_date IS NOT NULL
         AND deadline_date < CURRENT_DATE`
    )
  }
}

module.exports = new TasksService()
