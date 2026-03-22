import { api } from './client'

export const clientsApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return api.get(`/clients${qs ? `?${qs}` : ''}`)
  },
  get: (id) => api.get(`/clients/${id}`),
  create: (data) => api.post('/clients', data),
  update: (id, data) => api.patch(`/clients/${id}`, data),
  delete: (id) => api.delete(`/clients/${id}`),
  getTasks: (id) => api.get(`/clients/${id}/tasks`),
  getPayments: (id) => api.get(`/clients/${id}/payments`),
  getCalls: (id) => api.get(`/clients/${id}/calls`),
  addPayment: (id, data) => api.post(`/clients/${id}/payments`, data),
}
