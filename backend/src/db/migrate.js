'use strict'

const fs = require('fs')
const path = require('path')
const { pool } = require('./index')

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    const { rows: applied } = await client.query(
      'SELECT filename FROM migrations ORDER BY id'
    )
    const appliedSet = new Set(applied.map(r => r.filename))

    const migrationsDir = path.join(__dirname, 'migrations')
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort()

    let appliedCount = 0
    for (const filename of files) {
      if (appliedSet.has(filename)) continue

      console.log(`  ⚙  Applying migration: ${filename}`)
      const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf8')

      try {
        await client.query(sql)
        await client.query('INSERT INTO migrations (filename) VALUES ($1)', [filename])
        console.log(`  ✓  ${filename}`)
        appliedCount++
      } catch (err) {
        console.error(`  ✗  Error in ${filename}:`, err.message)
        throw err
      }
    }

    if (appliedCount > 0) {
      console.log(`✓ Applied ${appliedCount} migration(s)`)
    }
  } finally {
    client.release()
  }
}

// Если запущен напрямую
if (require.main === module) {
  migrate()
    .then(() => { console.log('Done'); process.exit(0) })
    .catch(err => { console.error(err); process.exit(1) })
}

module.exports = { migrate }
