import apiClient from './client';

export const laporanApi = {
  // Laporan Induk
  getAll: (params) => apiClient.get('/laporan', { params }),
  getById: (id) => apiClient.get(`/laporan/${id}`),
  create: (data) => apiClient.post('/laporan', data),
  update: (id, data) => apiClient.put(`/laporan/${id}`, data),
  delete: (id) => apiClient.delete(`/laporan/${id}`),

  // Sub-Laporan: KNA
  upsertKNA: (idLaporan, data) => apiClient.put(`/laporan/${idLaporan}/kna`, data),

  // Sub-Laporan: Penumpang
  getPenumpang: (idLaporan) => apiClient.get(`/laporan/${idLaporan}/penumpang`),
  addPenumpang: (idLaporan, data) => apiClient.post(`/laporan/${idLaporan}/penumpang`, data),
  updatePenumpang: (idLaporan, itemId, data) => apiClient.put(`/laporan/${idLaporan}/penumpang/${itemId}`, data),
  deletePenumpang: (idLaporan, itemId) => apiClient.delete(`/laporan/${idLaporan}/penumpang/${itemId}`),

  // Sub-Laporan: Barang
  getBarang: (idLaporan) => apiClient.get(`/laporan/${idLaporan}/barang`),
  addBarang: (idLaporan, data) => apiClient.post(`/laporan/${idLaporan}/barang`, data),
  updateBarang: (idLaporan, itemId, data) => apiClient.put(`/laporan/${idLaporan}/barang/${itemId}`, data),
  deleteBarang: (idLaporan, itemId) => apiClient.delete(`/laporan/${idLaporan}/barang/${itemId}`),

  // Sub-Laporan: Keuangan
  upsertKeuangan: (idLaporan, data) => apiClient.put(`/laporan/${idLaporan}/keuangan`, data),
};
