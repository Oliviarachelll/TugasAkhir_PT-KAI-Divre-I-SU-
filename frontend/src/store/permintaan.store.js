import { create } from 'zustand';
import { getPermintaan, createPermintaan, tanggapiPermintaan } from '../api/permintaan.api';

const usePermintaanStore = create((set, get) => ({
  permintaanList: [],
  isLoading: false,
  error: null,
  pagination: null,

  fetchPermintaan: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const { data, meta } = await getPermintaan(params);
      set({ permintaanList: data, pagination: meta, isLoading: false });
    } catch (error) {
      set({ 
        error: error.response?.data?.message || 'Gagal mengambil data permintaan',
        isLoading: false 
      });
    }
  },

  addPermintaan: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await createPermintaan(data);
      // Refresh list after adding
      await get().fetchPermintaan();
      return response.data;
    } catch (error) {
      set({ 
        error: error.response?.data?.message || 'Gagal membuat permintaan',
        isLoading: false 
      });
      throw error;
    }
  },

  updateTanggapan: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await tanggapiPermintaan(id, data);
      await get().fetchPermintaan();
      return response.data;
    } catch (error) {
      set({ 
        error: error.response?.data?.message || 'Gagal menanggapi permintaan',
        isLoading: false 
      });
      throw error;
    }
  }
}));

export default usePermintaanStore;
