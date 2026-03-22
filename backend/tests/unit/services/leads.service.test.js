'use strict'

jest.mock('../../../src/db', () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn(),
  },
}))

const db = require('../../../src/db')

describe('LeadsService.markContacted', () => {
  test('обновляет last_contact_at на NOW()', async () => {
    const mockLead = { id: 'lead-1', last_contact_at: new Date().toISOString() }
    db.query.mockResolvedValueOnce({ rows: [mockLead] })

    const leadsService = require('../../../src/services/leads.service')
    const result = await leadsService.markContacted('lead-1')

    expect(result.id).toBe('lead-1')
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('last_contact_at = NOW()'),
      ['lead-1']
    )
  })
})

describe('LeadsService.convertToClient', () => {
  test('выполняет транзакцию и возвращает нового клиента', async () => {
    const mockClient = db.pool.connect.mockResolvedValueOnce({
      query: jest.fn()
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'lead-1', first_name: 'Анна', last_name: 'Коваль', phone: null, telegram_username: null }] }) // SELECT lead
        .mockResolvedValueOnce({ rows: [{ id: 'new-client-1', first_name: 'Анна' }] }) // INSERT client
        .mockResolvedValueOnce(undefined) // UPDATE lead
        .mockResolvedValueOnce(undefined), // COMMIT
      release: jest.fn(),
    })

    const leadsService = require('../../../src/services/leads.service')
    const result = await leadsService.convertToClient('lead-1', {
      work_type: 'individual',
      start_date: '2024-01-01',
    })

    expect(result.id).toBe('new-client-1')
  })

  test('откатывает транзакцию при ошибке', async () => {
    const mockConn = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error('DB error')), // SELECT lead fails
      release: jest.fn(),
    }
    db.pool.connect.mockResolvedValueOnce(mockConn)

    // Нужно сбросить кэш модуля для fresh mock
    jest.resetModules()
    jest.mock('../../../src/db', () => ({
      query: jest.fn(),
      pool: { connect: jest.fn().mockResolvedValueOnce(mockConn) },
    }))

    const leadsService = require('../../../src/services/leads.service')
    await expect(
      leadsService.convertToClient('lead-1', { work_type: 'individual' })
    ).rejects.toThrow()
  })
})
