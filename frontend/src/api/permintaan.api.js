import client from './client';

export const getPermintaan = async (params) => {
  const response = await client.get('/api/permintaan', { params });
  return response.data;
};

export const createPermintaan = async (data) => {
  const response = await client.post('/api/permintaan', data);
  return response.data;
};

export const tanggapiPermintaan = async (id, data) => {
  const response = await client.patch(`/api/permintaan/${id}/tanggapi`, data);
  return response.data;
};
