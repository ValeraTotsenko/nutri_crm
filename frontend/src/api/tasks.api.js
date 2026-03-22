import { api } from './client'

export const tasksApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return api.get(`/tasks${qs ? `?${qs}` : ''}`)
  },
  create: (data) => api.post('/tasks', data),
  update: (id, data) => api.patch(`/tasks/${id}`, data),
  complete: (id) => api.post(`/tasks/${id}/complete`),
}
