import apiClient from './client';

export const penggunaApi = {
  getAll: async (params = {}) => {
    const response = await apiClient.get('/pengguna', { params });
    return response;
  },

  getById: async (id) => {
    const response = await apiClient.get(`/pengguna/${id}`);
    return response;
  },

  create: async (data) => {
    const response = await apiClient.post('/pengguna', data);
    return response;
  },

  update: async (id, data) => {
    const response = await apiClient.put(`/pengguna/${id}`, data);
    return response;
  },

  delete: async (id) => {
    const response = await apiClient.delete(`/pengguna/${id}`);
    return response;
  },

  unlock: async (id, data) => {
    const response = await apiClient.patch(`/pengguna/${id}/unlock`, data);
    return response;
  }
};
