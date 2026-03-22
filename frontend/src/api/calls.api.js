import { api } from './client'

export const callsApi = {
  upcoming: (days = 7) => api.get(`/calls/upcoming?days=${days}`),
  create: (data) => api.post('/calls', data),
  update: (id, data) => api.patch(`/calls/${id}`, data),
}
