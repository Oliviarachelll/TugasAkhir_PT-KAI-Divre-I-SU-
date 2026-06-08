import axios from 'axios';
import useAuthStore from '../store/auth.store';
import toast from 'react-hot-toast';

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || 'Terjadi kesalahan pada server';
    
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      toast.error('Sesi Anda telah habis. Silakan login kembali.');
    } else if (error.response?.status === 403) {
      toast.error('Anda tidak memiliki akses ke halaman ini.');
    } else {
      toast.error(message);
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
