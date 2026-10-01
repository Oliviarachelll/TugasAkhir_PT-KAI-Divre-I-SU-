import client from './client';

export const getPermintaan = (params) => client.get('/permintaan', { params });

export const createPermintaan = (data) => client.post('/permintaan', data);

export const tanggapiPermintaan = (id, data) => (
  client.patch(`/permintaan/${id}/tanggapi`, data)
);
