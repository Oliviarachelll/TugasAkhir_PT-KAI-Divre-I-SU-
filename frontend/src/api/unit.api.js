import apiClient from './client';

export const unitApi = {
  getAll: async (params = {}) => {
    const response = await apiClient.get('/unit', { params });
    return response;
  },

  getById: async (id) => {
    const response = await apiClient.get(`/unit/${id}`);
    return response;
  },

  create: async (data) => {
    const response = await apiClient.post('/unit', data);
    return response;
  },

  update: async (id, data) => {
    const response = await apiClient.put(`/unit/${id}`, data);
    return response;
  },

  delete: async (id) => {
    const response = await apiClient.delete(`/unit/${id}`);
    return response;
  }
};
