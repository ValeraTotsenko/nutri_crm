'use strict'

const tasksService = require('../services/tasks.service')

module.exports = async function (app) {
  const auth = { preHandler: [app.authenticate] }

  app.get('/tasks', auth, async (req) => {
    return tasksService.findAll(req.query)
  })

  app.get('/clients/:clientId/tasks', auth, async (req) => {
    return tasksService.findAll({ clientId: req.params.clientId })
  })

  app.post('/tasks', auth, async (req, reply) => {
    const required = ['client_id', 'title']
    for (const f of required) {
      if (!req.body[f]) return reply.badRequest(`Field '${f}' is required`)
    }
    const task = await tasksService.create(req.body)
    return reply.code(201).send(task)
  })

  app.patch('/tasks/:id', auth, async (req, reply) => {
    const task = await tasksService.update(req.params.id, req.body)
    if (!task) return reply.notFound('Task not found')
    return task
  })

  app.post('/tasks/:id/complete', auth, async (req, reply) => {
    const task = await tasksService.complete(req.params.id)
    if (!task) return reply.notFound('Task not found or already done')
    return task
  })
}
