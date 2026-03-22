import { api } from './client'

export const leadsApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return api.get(`/leads${qs ? `?${qs}` : ''}`)
  },
  get: (id) => api.get(`/leads/${id}`),
  create: (data) => api.post('/leads', data),
  update: (id, data) => api.patch(`/leads/${id}`, data),
  markContacted: (id) => api.post(`/leads/${id}/contact`),
  convert: (id, data) => api.post(`/leads/${id}/convert`, data),
  getCalls: (id) => api.get(`/leads/${id}/calls`),
}
