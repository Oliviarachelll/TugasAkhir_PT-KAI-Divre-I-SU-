import apiClient from './client';

export const targetApi = {
  getAll: (params) => apiClient.get('/target', { params }),
  create: (data) => apiClient.post('/target', data),
  update: (id, data) => apiClient.put(`/target/${id}`, data),
};
