import apiClient from './client';

export const programApi = {
  getAll: (params) => apiClient.get('/program', { params }),
  save: (data) => apiClient.put('/program', data),
};
