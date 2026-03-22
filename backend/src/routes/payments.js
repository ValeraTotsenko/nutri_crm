'use strict'

const paymentsService = require('../services/payments.service')

module.exports = async function (app) {
  const auth = { preHandler: [app.authenticate] }

  app.get('/clients/:clientId/payments', auth, async (req) => {
    return paymentsService.findByClientId(req.params.clientId)
  })

  app.post('/clients/:clientId/payments', auth, async (req, reply) => {
    if (!req.body.total_amount) return reply.badRequest("Field 'total_amount' is required")
    const payment = await paymentsService.create(req.params.clientId, req.body)
    return reply.code(201).send(payment)
  })

  app.patch('/payments/:id', auth, async (req, reply) => {
    const payment = await paymentsService.update(req.params.id, req.body)
    if (!payment) return reply.notFound('Payment not found')
    return payment
  })

  app.get('/payments/:id/transactions', auth, async (req) => {
    return paymentsService.getTransactions(req.params.id)
  })

  app.post('/payments/:id/transactions', auth, async (req, reply) => {
    if (!req.body.amount || !req.body.paid_at) {
      return reply.badRequest("Fields 'amount' and 'paid_at' are required")
    }
    const tx = await paymentsService.addTransaction(req.params.id, req.body)
    return reply.code(201).send(tx)
  })
}
