import apiClient from './client';

export const login = async (credentials) => {
  return await apiClient.post('/auth/login', credentials);
};

export const getProfile = async () => {
  return await apiClient.get('/auth/me');
};
