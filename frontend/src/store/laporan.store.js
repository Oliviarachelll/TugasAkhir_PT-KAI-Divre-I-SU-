import { create } from 'zustand';
import { laporanApi } from '../api/laporan.api';
import toast from 'react-hot-toast';
import useAuthStore from './auth.store';

const useLaporanStore = create((set, get) => ({
  laporanList: [],
  laporanDetail: null,
  isLoading: false,
  error: null,
  
  // State khusus form input (Draft)
  draftLaporan: {
    jenis_laporan: 'Data Harian',
    tanggal: new Date().toISOString().split('T')[0],
    id_unit: null,
    status: 'DRAFT',
    // Sub-laporan form
    penumpangItems: [],
    barangItems: [],
    kna: null,
    keuangan: { pendapatan: 0, pengeluaran: 0 },
  },

  setDraft: (data) => set((state) => ({ 
    draftLaporan: { ...state.draftLaporan, ...data } 
  })),

  resetDraft: () => set({
    draftLaporan: {
      jenis_laporan: 'Data Harian',
      tanggal: new Date().toISOString().split('T')[0],
      id_unit: null,
      status: 'DRAFT',
      penumpangItems: [],
      barangItems: [],
      kna: null,
      keuangan: null,
    }
  }),

  fetchLaporan: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const res = await laporanApi.getAll(params);
      set({ laporanList: res.data || [] });
    } catch (error) {
      set({ error: error.message });
      toast.error('Gagal mengambil data laporan');
    } finally {
      set({ isLoading: false });
    }
  },

  fetchLaporanById: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const res = await laporanApi.getById(id);
      set({ laporanDetail: res.data });
      return res.data;
    } catch (error) {
      set({ error: error.message });
      toast.error('Gagal mengambil detail laporan');
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  updateStatusLaporan: async (id, status, catatan) => {
    set({ isLoading: true, error: null });
    try {
      await laporanApi.update(id, { status, kotak_detail: catatan });
      toast.success(`Laporan berhasil di-${status === 'DISETUJUI' ? 'ACC' : 'REVISI'}!`);
      return true;
    } catch (error) {
      set({ error: error.message });
      toast.error('Gagal memperbarui status laporan');
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  submitDraft: async () => {
    set({ isLoading: true, error: null });
    try {
      const draft = get().draftLaporan;
      
      // 1. Buat atau Update Laporan Induk
      const userState = useAuthStore.getState().user;
      const finalIdUnit = draft.id_unit || userState?.id_unit || 1; // Fallback ke 1 jika darurat

      let idLaporanBaru = draft.id_laporan;
      const indukPayload = {
        tanggal: new Date(draft.tanggal).toISOString(),
        id_unit: finalIdUnit,
        kotak_detail: draft.kotak_detail || null,
      };

      if (idLaporanBaru) {
        await laporanApi.update(idLaporanBaru, indukPayload);
      } else {
        const resInduk = await laporanApi.create(indukPayload);
        idLaporanBaru = resInduk.data.id_laporan;
      }

      const { penumpangItems, barangItems, kna, keuangan } = draft;

      // 2. Simpan Sub-Laporan (jika ada isinya)
      if (penumpangItems && penumpangItems.length > 0) {
        const pendapatanKaObj = draft.pendapatanKa || {};
        const appliedKa = new Set();
        
        for (const item of penumpangItems) {
          const payload = { ...item };
          if (!appliedKa.has(payload.nama_ka)) {
            payload.pendapatan = pendapatanKaObj[payload.nama_ka] || 0;
            appliedKa.add(payload.nama_ka);
          } else {
            payload.pendapatan = 0;
          }
          Object.keys(payload).forEach(k => { if(payload[k] === '') payload[k] = 0; });
          await laporanApi.addPenumpang(idLaporanBaru, payload);
        }
      }

      if (barangItems && barangItems.length > 0) {
        for (const item of barangItems) {
          const payload = { ...item };
          Object.keys(payload).forEach(k => { if(payload[k] === '') payload[k] = 0; });
          if (payload.id_laporan_barang) {
            await laporanApi.updateBarang(idLaporanBaru, payload.id_laporan_barang, payload);
          } else {
            await laporanApi.addBarang(idLaporanBaru, payload);
          }
        }
      }

      if (draft.deletedBarangItems && draft.deletedBarangItems.length > 0) {
        for (const itemId of draft.deletedBarangItems) {
          await laporanApi.deleteBarang(idLaporanBaru, itemId);
        }
      }

      if (draft.barangTotal) {
        const payload = { ...draft.barangTotal, id_komoditi: 99, jml_ka: 0 };
        Object.keys(payload).forEach(k => { if(payload[k] === '') payload[k] = 0; });
        if (payload.id_laporan_barang) {
          await laporanApi.updateBarang(idLaporanBaru, payload.id_laporan_barang, payload);
        } else {
          await laporanApi.addBarang(idLaporanBaru, payload);
        }
      }

      if (kna) {
        const hasKnaData = Object.keys(kna).some(k => kna[k] !== '');
        if (hasKnaData) {
          const payload = { ...kna };
          Object.keys(payload).forEach(k => { if(payload[k] === '') payload[k] = 0; });
          await laporanApi.upsertKNA(idLaporanBaru, payload);
        }
      }

      if (keuangan && (keuangan.pendapatan !== '' || keuangan.pengeluaran !== '')) {
        const payload = { ...keuangan };
        Object.keys(payload).forEach(k => { if(payload[k] === '') payload[k] = 0; });
        await laporanApi.upsertKeuangan(idLaporanBaru, payload);
      }

      // 3. Ubah status menjadi DIAJUKAN dan set status internal
      await laporanApi.update(idLaporanBaru, { 
        status: 'DIAJUKAN',
        status_internal: draft.status_internal || 'PENDING'
      });
      
      toast.success('Laporan berhasil disubmit!');
      get().resetDraft();
      return true;
    } catch (error) {
      set({ error: error.message });
      toast.error('Gagal submit laporan');
      return false;
    } finally {
      set({ isLoading: false });
    }
  }
}));

export default useLaporanStore;
