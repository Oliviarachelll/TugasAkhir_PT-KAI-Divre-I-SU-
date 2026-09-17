import axios from 'axios';
import useAuthStore from '../store/auth.store';
import toast from 'react-hot-toast';
import i18n from '../i18n';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
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
    const message = error.response?.data?.message || i18n.t('api.server_error');
    
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      toast.error(i18n.t('api.session_expired'));
    } else if (error.response?.status === 403) {
      toast.error(i18n.t('api.forbidden'));
    } else {
      toast.error(message);
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
