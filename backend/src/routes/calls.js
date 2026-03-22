'use strict'

const callsService = require('../services/calls.service')

module.exports = async function (app) {
  const auth = { preHandler: [app.authenticate] }

  app.get('/calls/upcoming', auth, async (req) => {
    return callsService.getUpcoming(req.query.days || 7)
  })

  app.get('/clients/:clientId/calls', auth, async (req) => {
    return callsService.findByClientId(req.params.clientId)
  })

  app.get('/leads/:leadId/calls', auth, async (req) => {
    return callsService.findByLeadId(req.params.leadId)
  })

  app.post('/calls', auth, async (req, reply) => {
    const required = ['scheduled_at', 'call_type']
    for (const f of required) {
      if (!req.body[f]) return reply.badRequest(`Field '${f}' is required`)
    }
    if (!req.body.client_id && !req.body.lead_id) {
      return reply.badRequest("Either 'client_id' or 'lead_id' is required")
    }
    const call = await callsService.create(req.body)
    return reply.code(201).send(call)
  })

  app.patch('/calls/:id', auth, async (req, reply) => {
    const call = await callsService.update(req.params.id, req.body)
    if (!call) return reply.notFound('Call not found')
    return call
  })
}
