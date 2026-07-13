import client from './client';

export const getPermintaan = async (params) => {
  const response = await client.get('/permintaan', { params });
  return response;
};

export const createPermintaan = async (data) => {
  const response = await client.post('/permintaan', data);
  return response;
};

export const tanggapiPermintaan = async (id, data) => {
  const response = await client.patch(`/permintaan/${id}/tanggapi`, data);
  return response;
};
