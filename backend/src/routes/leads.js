'use strict'

const leadsService = require('../services/leads.service')

module.exports = async function (app) {
  const auth = { preHandler: [app.authenticate] }

  app.get('/leads', auth, async (req) => {
    return leadsService.findAll(req.query)
  })

  app.get('/leads/:id', auth, async (req, reply) => {
    const lead = await leadsService.findById(req.params.id)
    if (!lead) return reply.notFound('Lead not found')
    return lead
  })

  app.post('/leads', auth, async (req, reply) => {
    if (!req.body.first_name) return reply.badRequest("Field 'first_name' is required")
    const lead = await leadsService.create(req.body)
    return reply.code(201).send(lead)
  })

  app.patch('/leads/:id', auth, async (req, reply) => {
    const lead = await leadsService.update(req.params.id, req.body)
    if (!lead) return reply.notFound('Lead not found')
    return lead
  })

  // Кнопка «Написала» — обновить last_contact_at
  app.post('/leads/:id/contact', auth, async (req, reply) => {
    const lead = await leadsService.markContacted(req.params.id)
    if (!lead) return reply.notFound('Lead not found')
    return lead
  })

  // Конвертация лида в клиента
  app.post('/leads/:id/convert', auth, async (req, reply) => {
    const required = ['work_type']
    for (const field of required) {
      if (!req.body[field]) return reply.badRequest(`Field '${field}' is required`)
    }
    try {
      const client = await leadsService.convertToClient(req.params.id, req.body)
      return reply.code(201).send(client)
    } catch (err) {
      if (err.message.includes('not found or already converted')) {
        return reply.notFound(err.message)
      }
      throw err
    }
  })
}
