import { create } from 'zustand';
import { laporanApi } from '../api/laporan.api';
import toast from 'react-hot-toast';
import i18n from '../i18n';
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

  setDraft: (data) => set((state) => {
    const update = typeof data === 'function' ? data(state.draftLaporan) : data;
    return { draftLaporan: { ...state.draftLaporan, ...update } };
  }),

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
      toast.error(i18n.t('store.fetch_fail'));
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
      toast.error(i18n.t('store.detail_fail'));
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  updateStatusLaporan: async (id, status, catatan) => {
    set({ isLoading: true, error: null });
    try {
      await laporanApi.update(id, { status, kotak_detail: catatan });
      toast.success(i18n.t(status === 'DISETUJUI' ? 'store.status_success_acc' : 'store.status_success_revisi'));
      return true;
    } catch (error) {
      set({ error: error.message });
      toast.error(i18n.t('store.status_fail'));
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  unlockLaporan: async (id, token) => {
    set({ isLoading: true, error: null });
    try {
      await laporanApi.unlock(id, token);
      toast.success(i18n.t('store.unlock_success'));
      return true;
    } catch (error) {
      const msg = error.response?.data?.message || i18n.t('store.unlock_fail');
      set({ error: msg });
      toast.error(msg);
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

      if (idLaporanBaru && draft.status !== 'REVISI') {
        await laporanApi.update(idLaporanBaru, indukPayload);
      } else if (!idLaporanBaru) {
        const resInduk = await laporanApi.create(indukPayload);
        idLaporanBaru = resInduk.data.id_laporan;
      }

      const { penumpangItems, barangItems, kna, keuangan } = draft;

      // Resubmit revisi menggunakan satu request atomik agar ID laporan tetap sama,
      // snapshot konsisten, dan item lama tidak terduplikasi.
      if (draft.id_laporan && draft.status === 'REVISI') {
        const pendapatanKaObj = draft.pendapatanKa || {};
        const appliedKa = new Set();
        const revisionPenumpang = (penumpangItems || []).map(item => {
          const payload = { ...item };
          payload.pendapatan = appliedKa.has(payload.nama_ka) ? 0 : (pendapatanKaObj[payload.nama_ka] || payload.pendapatan || 0);
          appliedKa.add(payload.nama_ka);
          if (payload.jml_penumpang === '') payload.jml_penumpang = 0;
          return payload;
        });
        const revisionBarang = (barangItems || []).map(item => {
          const payload = { ...item };
          ['jml_ka', 'volume', 'volume_kumulatif', 'volume_program', 'volume_pencapaian', 'pendapatan', 'pendapatan_kumulatif', 'pendapatan_program', 'pendapatan_pencapaian']
            .forEach(key => { if (payload[key] === '') payload[key] = 0; });
          return payload;
        });
        if (revisionBarang.length > 0) {
          const autoVolume = revisionBarang.reduce((sum, item) => sum + (Number(item.volume) || 0), 0);
          const autoPendapatan = revisionBarang.reduce((sum, item) => sum + (Number(item.pendapatan) || 0), 0);
          const total = { volume: autoVolume, pendapatan: autoPendapatan, ...(draft.barangTotal || {}), id_komoditi: 99, jml_ka: 0 };
          Object.keys(total).forEach(key => { if (total[key] === '') total[key] = 0; });
          revisionBarang.push(total);
        }
        const normalizeNumericEmpty = (value, numericFields) => value ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, item === '' && numericFields.includes(key) ? 0 : item])) : null;
        await laporanApi.resubmit(draft.id_laporan, {
          tanggal: new Date(draft.tanggal).toISOString(),
          kotak_detail: draft.kotak_detail || null,
          status_internal: draft.status_internal || 'PENDING',
          kna: normalizeNumericEmpty(kna, ['jml_kontrak_row', 'luas_t_row', 'luas_b_row', 'nilai_row', 'target_rkad', 'realisasi_rkad', 'jml_kontrak_non_row', 'luas_t_non_row', 'luas_b_non_row', 'nilai_non_row']),
          penumpangItems: revisionPenumpang,
          barangItems: revisionBarang,
          keuangan: normalizeNumericEmpty(keuangan, ['target_rkad', 'realisasi_rkad', 'pendapatan', 'pengeluaran']),
        });
        toast.success(i18n.t('store.resubmit_success'));
        get().resetDraft();
        return true;
      }

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

      // Selalu simpan id_komoditi 99 (TOTAL) baik diisi manual atau dihitung otomatis
      if (barangItems && barangItems.length > 0) {
        let autoVolume = 0;
        let autoPendapatan = 0;
        barangItems.forEach(b => {
          autoVolume += parseFloat(b.volume) || 0;
          autoPendapatan += parseFloat(b.pendapatan) || 0;
        });

        const payload = { 
          volume: autoVolume,
          pendapatan: autoPendapatan,
          ...(draft.barangTotal || {}), 
          id_komoditi: 99, 
          jml_ka: 0 
        };
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
      
      toast.success(i18n.t('store.submit_success'));
      get().resetDraft();
      return true;
    } catch (error) {
      const message = error.response?.data?.message || i18n.t('store.submit_fail');
      set({ error: message });
      toast.error(message);
      return false;
    } finally {
      set({ isLoading: false });
    }
  }
}));

export default useLaporanStore;
