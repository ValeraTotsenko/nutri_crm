import { api } from './client'

export const paymentsApi = {
  update: (id, data) => api.patch(`/payments/${id}`, data),
  getTransactions: (id) => api.get(`/payments/${id}/transactions`),
  addTransaction: (id, data) => api.post(`/payments/${id}/transactions`, data),
}
