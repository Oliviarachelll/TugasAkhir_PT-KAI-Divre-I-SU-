import client from './client';

export const systemApi = {
  getSystemStats: async () => {
    const response = await client.get('/system/stats');
    return response.data;
  },
};

export default systemApi;
