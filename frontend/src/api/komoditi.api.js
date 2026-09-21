import apiClient from './client';

export const komoditiApi = {
  getAll: (params) => apiClient.get('/komoditi', { params }),
};
