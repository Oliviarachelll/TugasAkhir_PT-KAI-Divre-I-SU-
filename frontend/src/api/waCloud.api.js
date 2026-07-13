import apiClient from './client';

export const waCloudApi = {
  /**
   * Mengirim pesan broadcast via Meta Cloud API ke semua USER_UNIT
   * @param {Object} data payload
   * @param {string} data.messageType 'text' atau 'template'
   * @param {string} data.messageText isi pesan (jika type text)
   * @param {string} data.templateName nama template (jika type template)
   */
  sendBroadcast: async (data) => {
    const response = await apiClient.post('/wacloud/broadcast', data);
    return response;
  },

  /**
   * Create a new template on Meta
   * @param {Object} data payload
   * @param {string} data.name Nama template
   * @param {string} data.body Isi pesan template
   */
  createTemplate: async (data) => {
    const response = await apiClient.post('/wacloud/templates', data);
    return response;
  },

  /**
   * Fetch templates from Meta
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
  }
};
