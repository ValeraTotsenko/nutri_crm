'use strict'

const { Pool } = require('pg')
const config = require('../config')

const pool = new Pool({
  connectionString: config.db.connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err)
})

async function query(text, params) {
  const start = Date.now()
  const res = await pool.query(text, params)
  const duration = Date.now() - start
  if (duration > 1000) {
    console.warn('Slow query:', { text: text.substring(0, 100), duration })
  }
  return res
}

async function healthCheck() {
  const result = await pool.query('SELECT NOW() AS now')
  return result.rows[0].now
}

module.exports = { query, pool, healthCheck }
