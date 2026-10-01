import apiClient from './client';

export const waCloudApi = {
  sendBroadcast: (data) => apiClient.post('/wacloud/broadcast', data),
  createTemplate: (data) => apiClient.post('/wacloud/templates', data),
  getTemplates: () => apiClient.get('/wacloud/templates'),
  getLogs: (params = {}) => apiClient.get('/wacloud/logs', { params }),
  getMetrics: () => apiClient.get('/wacloud/metrics'),
  getWaStatus: () => apiClient.get('/wacloud/status'),
  getPairingQr: () => apiClient.get('/wacloud/pairing-qr'),
  getUnitBelumLapor: () => apiClient.get('/wacloud/belum-lapor'),
  kirimPerUnit: (idUnit, data = {}) => (
    apiClient.post(`/wacloud/kirim-unit/${idUnit}`, data)
  ),
};
