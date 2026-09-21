import axios from 'axios';
import useAuthStore from '../store/auth.store';
import toast from 'react-hot-toast';
import i18n from '../i18n';

// ID toast tetap untuk error API: interceptor + penanganan lokal memakai
// ID yang sama sehingga tidak muncul dua toast identik bertumpuk.
export const API_ERROR_TOAST_ID = 'api-error';

// Bangun pesan error yang memuat detail field pertama bila backend
// mengirim array `errors` (mis. hasil validasi Zod), agar user tahu
// field mana yang bermasalah, bukan sekadar "Validasi gagal".
export const apiErrorMessage = (error, fallback = '') => {
  const data = error?.response?.data;
  const first = Array.isArray(data?.errors) && data.errors.length > 0 ? data.errors[0] : null;
  const detail = first ? ` (${first.field}: ${first.message})` : '';
  return `${data?.message || fallback}${detail}`;
};

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
    // Request ke endpoint auth (login / reset-password / unlock) TIDAK boleh
    // memicu logout global: 401 di sana artinya kredensial salah, dan halaman
    // login sendiri yang menampilkan pesannya. Tanpa pengecualian ini, salah
    // password me-reload halaman login dan error tidak pernah terlihat.
    const url = error.config?.url || '';
    const isAuthRequest = url.startsWith('/auth/');
    if (error.response?.status === 401 && !isAuthRequest) {
      useAuthStore.getState().logout();
      toast.error(i18n.t('api.session_expired'));
    } else if (error.response?.status === 403) {
      toast.error(i18n.t('api.forbidden'));
    } else {
      toast.error(apiErrorMessage(error, i18n.t('api.server_error')), { id: API_ERROR_TOAST_ID });
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
