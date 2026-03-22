'use strict'

const db = require('../db')

class LeadsService {
  async findAll({ status, noContactDays } = {}) {
    const conditions = ['converted_to_client_id IS NULL']
    const params = []
    let idx = 1

    if (status) {
      if (Array.isArray(status)) {
        conditions.push(`status = ANY($${idx}::lead_status_enum[])`)
        params.push(status)
      } else {
        conditions.push(`status = $${idx}`)
        params.push(status)
      }
      idx++
    } else {
      conditions.push(`status != 'refused'`)
    }

    if (noContactDays) {
      conditions.push(`last_contact_at < NOW() - INTERVAL '${parseInt(noContactDays)} days'`)
    }

    const result = await db.query(
      `SELECT l.*,
        EXTRACT(DAY FROM NOW() - last_contact_at)::int AS days_since_contact,
        c.first_name AS referred_by_first_name, c.last_name AS referred_by_last_name
       FROM leads l
       LEFT JOIN clients c ON c.id = l.referred_by_client_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY last_contact_at ASC`,
      params
    )
    return result.rows
  }

  async findById(id) {
    const result = await db.query(
      `SELECT l.*,
        EXTRACT(DAY FROM NOW() - last_contact_at)::int AS days_since_contact,
        c.first_name AS referred_by_first_name, c.last_name AS referred_by_last_name
       FROM leads l
       LEFT JOIN clients c ON c.id = l.referred_by_client_id
       WHERE l.id = $1`,
      [id]
    )
    if (!result.rows[0]) return null
    const lead = result.rows[0]

    const callsRes = await db.query(
      `SELECT * FROM calls WHERE lead_id = $1 ORDER BY scheduled_at DESC`,
      [id]
    )
    return { ...lead, calls: callsRes.rows }
  }

  async create(data) {
    const {
      last_name, first_name, telegram_username, phone, status = 'new',
      interest, source, referred_by_client_id, remind_after_days = 7, notes,
    } = data
    const result = await db.query(
      `INSERT INTO leads (last_name, first_name, telegram_username, phone, status, interest, source, referred_by_client_id, remind_after_days, notes, last_contact_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW())
       RETURNING *`,
      [last_name || null, first_name, telegram_username || null, phone || null,
       status, interest || null, source || null, referred_by_client_id || null,
       remind_after_days, notes || null]
    )
    return result.rows[0]
  }

  async update(id, data) {
    const allowed = ['last_name','first_name','telegram_username','phone','status',
      'interest','source','referred_by_client_id','remind_after_days','notes',
      'had_free_diagnostic','diagnostic_call_id']
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
      `UPDATE leads SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      params
    )
    return result.rows[0] || null
  }

  async markContacted(id) {
    const result = await db.query(
      `UPDATE leads SET last_contact_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    )
    return result.rows[0] || null
  }

  async convertToClient(id, clientData) {
    const client = await db.pool.connect()
    try {
      await client.query('BEGIN')

      const leadRes = await client.query(
        `SELECT * FROM leads WHERE id = $1 AND converted_to_client_id IS NULL`,
        [id]
      )
      if (!leadRes.rows[0]) throw new Error('Lead not found or already converted')
      const lead = leadRes.rows[0]

      // Создаём клиента
      const newClientRes = await client.query(
        `INSERT INTO clients (last_name, first_name, phone, telegram_username, work_type, goal, start_date, status, notes, source_lead_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9)
         RETURNING *`,
        [
          clientData.last_name || lead.last_name,
          clientData.first_name || lead.first_name,
          clientData.phone || lead.phone,
          clientData.telegram_username || lead.telegram_username,
          clientData.work_type,
          clientData.goal || lead.interest,
          clientData.start_date || new Date().toISOString().split('T')[0],
          clientData.notes || lead.notes,
          id,
        ]
      )
      const newClient = newClientRes.rows[0]

      // Обновляем лида
      await client.query(
        `UPDATE leads SET converted_to_client_id = $1, status = 'refused', updated_at = NOW() WHERE id = $2`,
        [newClient.id, id]
      )

      await client.query('COMMIT')
      return newClient
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }
}

module.exports = new LeadsService()
