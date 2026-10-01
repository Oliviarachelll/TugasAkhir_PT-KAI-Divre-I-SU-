import apiClient from './client';

export const login = (credentials) => apiClient.post('/auth/login', credentials);

export const getProfile = () => apiClient.get('/auth/profile');

export const updateWhatsappContact = ({ phone, password }) => (
  apiClient.patch('/auth/profile/whatsapp', {
    no_hp: phone,
    kata_sandi: password,
  })
);

export const requestPasswordReset = (email) => (
  apiClient.post('/auth/reset-password/request', { email })
);

export const requestUnlockTicket = (email) => (
  apiClient.post('/auth/request-unlock-ticket', { email })
);

export const resetPassword = ({ token, password }) => (
  apiClient.post('/auth/reset-password', {
    token,
    kata_sandi_baru: password,
  })
);
