'use strict'

const db = require('../db')

class CallsService {
  async findByClientId(clientId) {
    const result = await db.query(
      `SELECT * FROM calls WHERE client_id = $1 ORDER BY scheduled_at DESC`,
      [clientId]
    )
    return result.rows
  }

  async findByLeadId(leadId) {
    const result = await db.query(
      `SELECT * FROM calls WHERE lead_id = $1 ORDER BY scheduled_at DESC`,
      [leadId]
    )
    return result.rows
  }

  async create(data) {
    const { client_id, lead_id, scheduled_at, call_type, duration_min, platform, notes } = data
    const result = await db.query(
      `INSERT INTO calls (client_id, lead_id, scheduled_at, call_type, duration_min, platform, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [client_id || null, lead_id || null, scheduled_at, call_type,
       duration_min || null, platform || null, notes || null]
    )
    return result.rows[0]
  }

  async update(id, data) {
    const allowed = ['scheduled_at','call_type','duration_min','platform','status','notes']
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
      `UPDATE calls SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    )
    return result.rows[0] || null
  }

  async getUpcoming(days = 7) {
    const result = await db.query(
      `SELECT cl.*, c.first_name, c.last_name, l.first_name AS lead_first_name, l.last_name AS lead_last_name
       FROM calls cl
       LEFT JOIN clients c ON c.id = cl.client_id
       LEFT JOIN leads l ON l.id = cl.lead_id
       WHERE cl.status = 'scheduled'
         AND cl.scheduled_at >= NOW()
         AND cl.scheduled_at <= NOW() + INTERVAL '${parseInt(days)} days'
       ORDER BY cl.scheduled_at ASC`
    )
    return result.rows
  }

  // Для планировщика: созвоны завтра
  async getCallsTomorrow() {
    const result = await db.query(
      `SELECT cl.*, c.first_name, c.last_name, c.work_type,
        l.first_name AS lead_first_name, l.last_name AS lead_last_name, l.interest
       FROM calls cl
       LEFT JOIN clients c ON c.id = cl.client_id
       LEFT JOIN leads l ON l.id = cl.lead_id
       WHERE cl.status = 'scheduled'
         AND cl.scheduled_at::date = CURRENT_DATE + 1`
    )
    return result.rows
  }
}

module.exports = new CallsService()
