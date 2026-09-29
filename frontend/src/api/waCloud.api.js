import apiClient from './client';

export const waCloudApi = {
  /**
   * Mengirim pesan broadcast via Baileys ke USER_UNIT (migrasi dari Meta Cloud API)
   * @param {Object} data payload
   * @param {string} data.messageType 'text' atau 'template'
   * @param {string} data.messageText isi pesan (jika type text)
   * @param {string} data.templateName nama template lokal (jika type template)
   * @param {string} [data.unitPenerima] 'SEMUA' | 'PUSAT' | 'DAERAH' | 'CABANG'
   */
  sendBroadcast: async (data) => {
    const response = await apiClient.post('/wacloud/broadcast', data);
    return response;
  },

  /**
   * Create a new template lokal (Baileys, tanpa approval Meta)
   * @param {Object} data payload
   * @param {string} data.name Nama template
   * @param {string} data.body Isi pesan template
   */
  createTemplate: async (data) => {
    const response = await apiClient.post('/wacloud/templates', data);
    return response;
  },

  /**
   * Fetch templates lokal (Baileys)
   */
  getTemplates: async () => {
    const response = await apiClient.get('/wacloud/templates');
    return response;
  },

  /**
   * Fetch broadcast logs
   */
  getLogs: async () => {
    const response = await apiClient.get('/wacloud/logs');
    return response;
  },

  /**
   * Status koneksi Baileys untuk badge UI admin
   */
  getWaStatus: async () => {
    const response = await apiClient.get('/wacloud/status');
    return response;
  },

  /**
   * Daftar unit yang belum lapor bulan berjalan
   */
  getUnitBelumLapor: async () => {
    const response = await apiClient.get('/wacloud/belum-lapor');
    return response;
  },

  /**
   * Kirim pengingat manual ke 1 unit via Baileys
   * @param {number} idUnit
   * @param {Object} [data] opsional { tenggat }
   */
  kirimPerUnit: async (idUnit, data = {}) => {
    const response = await apiClient.post(`/wacloud/kirim-unit/${idUnit}`, data);
    return response;
  }
};
