'use strict'

const clientsService = require('../services/clients.service')

module.exports = async function (app) {
  const auth = { preHandler: [app.authenticate] }

  app.get('/clients', auth, async (req, reply) => {
    const clients = await clientsService.findAll(req.query)
    return clients
  })

  app.get('/clients/:id', auth, async (req, reply) => {
    const client = await clientsService.findById(req.params.id)
    if (!client) return reply.notFound('Client not found')
    return client
  })

  app.post('/clients', auth, async (req, reply) => {
    const required = ['last_name', 'first_name', 'work_type', 'start_date']
    for (const field of required) {
      if (!req.body[field]) {
        return reply.badRequest(`Field '${field}' is required`)
      }
    }
    const client = await clientsService.create(req.body)
    return reply.code(201).send(client)
  })

  app.patch('/clients/:id', auth, async (req, reply) => {
    const client = await clientsService.update(req.params.id, req.body)
    if (!client) return reply.notFound('Client not found')
    return client
  })

  app.delete('/clients/:id', auth, async (req, reply) => {
    const result = await clientsService.archive(req.params.id)
    if (!result) return reply.notFound('Client not found')
    return { success: true }
  })
}
