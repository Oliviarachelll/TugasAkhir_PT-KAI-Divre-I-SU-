import apiClient from './client';

const normalizeFilters = (filters = {}) => Object.fromEntries(
  Object.entries(filters).filter(([, value]) => value !== '' && value !== null && value !== undefined)
);

export const exportApi = {
  downloadLaporan: (format, filters = {}) => apiClient.post(
    `/exports/laporan/${format}`,
    { filters: normalizeFilters(filters) },
    { responseType: 'blob' }
  ),
};
