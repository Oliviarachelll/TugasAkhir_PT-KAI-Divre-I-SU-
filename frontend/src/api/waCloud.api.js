import apiClient from './client';

const generateRequestKey = (prefix = 'req') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const waCloudApi = {
  sendBroadcast: (data = {}) => {
    const payload = { ...data };
    if (payload.force && !payload.requestKey) {
      payload.requestKey = generateRequestKey('bcast');
    }
    return apiClient.post('/wacloud/broadcast', payload);
  },
  createTemplate: (data) => apiClient.post('/wacloud/templates', data),
  getTemplates: () => apiClient.get('/wacloud/templates'),
  getLogs: (params = {}) => apiClient.get('/wacloud/logs', { params }),
  getMetrics: () => apiClient.get('/wacloud/metrics'),
  getWaStatus: () => apiClient.get('/wacloud/status'),
  getPairingQr: () => apiClient.get('/wacloud/pairing-qr'),
  getUnitBelumLapor: (params = {}) => apiClient.get('/wacloud/belum-lapor', { params }),
  kirimPerUnit: (idUnit, data = {}) => {
    const payload = { ...data };
    if (payload.force && !payload.requestKey) {
      payload.requestKey = generateRequestKey(`unit-${idUnit}`);
    }
    return apiClient.post(`/wacloud/kirim-unit/${idUnit}`, payload);
  },
};
