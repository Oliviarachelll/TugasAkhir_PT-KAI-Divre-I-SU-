import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Save, Send, ShieldCheck } from 'lucide-react';
import useLaporanStore from '../../store/laporan.store';
import useAuthStore from '../../store/auth.store';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import FormKNA from './components/FormKNA';
import FormBarang from './components/FormBarang';
import FormPenumpang from './components/FormPenumpang';
import FormKeuangan from './components/FormKeuangan';
import { formatDate } from '../../utils/format';
import { targetApi } from '../../api/target.api';
import { unitKategori } from '../../utils/unit';

const InputLaporan = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const { draftLaporan, setDraft, submitDraft, isLoading, fetchLaporan, loadDraftFromLaporan, laporanList } = useLaporanStore();
  const { user } = useAuthStore();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const todayStr = new Date().toISOString().split('T')[0];
  // Mode edit (DRAFT) / resubmit (REVISI): tanggal asli laporan dipertahankan.
  // Mode input baru: tanggal selalu hari ini (tanpa pilihan).
  const isEditMode = !!draftLaporan.id_laporan;

  const steps = [
    { id: 1, name: t('laporan.step_draft'), status: 'current' },
    { id: 2, name: t('laporan.step_ready'), status: 'upcoming' },
    { id: 3, name: t('laporan.step_waiting'), status: 'upcoming' },
  ];

  const unitName = user?.unit?.nama_unit || '';

  // Target tahunan master unit ini (sumber field target read-only di form).
  const [targetTahunan, setTargetTahunan] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await targetApi.getAll({ tahun: new Date().getFullYear() });
        const found = (res.data || []).find((item) => item.kategori === unitKategori(unitName));
        setTargetTahunan(found ? Number(found.nilai) : null);
      } catch {
        setTargetTahunan(null);
      }
    })();
  }, [unitName]);

  // Akumulasi YTD (tahun berjalan, s/d kemarin) per komoditi dari laporan
  // DISETUJUI — basis angka Kumulatif otomatis form barang. Exclude id 99.
  const ytdKomoditi = React.useMemo(() => {
    const map = {};
    const yr = String(draftLaporan.tanggal ? new Date(draftLaporan.tanggal).getFullYear() : new Date().getFullYear());
    const myUnit = draftLaporan.id_unit || user?.id_unit;
    (laporanList || []).forEach((l) => {
      if (l.status !== 'DISETUJUI') return;
      if (myUnit && l.id_unit !== myUnit) return;
      const tgl = String(l.tanggal || '').slice(0, 10);
      if (!tgl.startsWith(yr) || tgl >= todayStr) return;
      (l.laporan_barang || []).forEach((b) => {
        if (b.id_komoditi === 99) return;
        const key = b.id_komoditi === 98
          ? `custom:${String(b.nama_kustom || '').toUpperCase()}`
          : String(b.id_komoditi);
        if (!map[key]) map[key] = { volume: 0, pendapatan: 0 };
        map[key].volume += parseFloat(b.volume) || 0;
        map[key].pendapatan += parseFloat(b.pendapatan) || 0;
      });
    });
    return map;
  }, [laporanList, draftLaporan.tanggal, draftLaporan.id_unit, user, todayStr]);

  // Inisialisasi draft saat pertama kali render
  useEffect(() => {
    if (!draftLaporan.id_unit && user?.id_unit) {
      setDraft({ id_unit: user.id_unit });
    }
    if (!draftLaporan.kna) {
      setDraft({ kna: { 
        target_rkad: '', realisasi_rkad: '', 
        jml_kontrak_row: '', luas_t_row: '', luas_b_row: '', nilai_row: '',
        jml_kontrak_non_row: '', luas_t_non_row: '', luas_b_non_row: '', nilai_non_row: ''
      } });
    }
    if (!draftLaporan.keuangan) setDraft({ keuangan: { pendapatan: '', pengeluaran: '' } });

    if (!draftLaporan.barangItems || draftLaporan.barangItems.length === 0) {
      setDraft({ barangItems: [
        { id_komoditi: 10, jml_ka: '', volume: '', volume_kumulatif: '', volume_program: '', volume_pencapaian: '', pendapatan: '', pendapatan_kumulatif: '', pendapatan_program: '', pendapatan_pencapaian: '' },
        { id_komoditi: 11, jml_ka: '', volume: '', volume_kumulatif: '', volume_program: '', volume_pencapaian: '', pendapatan: '', pendapatan_kumulatif: '', pendapatan_program: '', pendapatan_pencapaian: '' },
        { id_komoditi: 12, jml_ka: '', volume: '', volume_kumulatif: '', volume_program: '', volume_pencapaian: '', pendapatan: '', pendapatan_kumulatif: '', pendapatan_program: '', pendapatan_pencapaian: '' },
        { id_komoditi: 13, jml_ka: '', volume: '', volume_kumulatif: '', volume_program: '', volume_pencapaian: '', pendapatan: '', pendapatan_kumulatif: '', pendapatan_program: '', pendapatan_pencapaian: '' },
        { id_komoditi: 14, jml_ka: '', volume: '', volume_kumulatif: '', volume_program: '', volume_pencapaian: '', pendapatan: '', pendapatan_kumulatif: '', pendapatan_program: '', pendapatan_pencapaian: '' },
        { id_komoditi: 15, jml_ka: '', volume: '', volume_kumulatif: '', volume_program: '', volume_pencapaian: '', pendapatan: '', pendapatan_kumulatif: '', pendapatan_program: '', pendapatan_pencapaian: '' },
      ]});
    }

    if (!draftLaporan.barangTotal) {
      setDraft({ barangTotal: { volume: '', volume_kumulatif: '', volume_program: '', volume_pencapaian: '', pendapatan: '', pendapatan_kumulatif: '', pendapatan_program: '', pendapatan_pencapaian: '' } });
    }
  }, [draftLaporan.kna, draftLaporan.keuangan, draftLaporan.id_unit, draftLaporan.barangItems, draftLaporan.barangTotal, user, setDraft]);

  // Tanggal input baru selalu hari ini (tanpa pilihan). Mode edit/resubmit
  // mempertahankan tanggal asli laporan.
  useEffect(() => {
    if (isEditMode) return;
    if (!draftLaporan.id_laporan && draftLaporan.tanggal !== todayStr) {
      setDraft({ tanggal: todayStr });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guard duplikat: satu unit hanya boleh punya satu laporan per tanggal,
  // kecuali DRAFT (dilanjutkan) dan REVISI (alur resubmit).
  useEffect(() => {
    (async () => {
      if (isEditMode) return; // mode edit/resubmit
      await fetchLaporan({ limit: 1000 });
      const list = useLaporanStore.getState().laporanList || [];
      const myUnit = draftLaporan.id_unit || user?.id_unit;
      const existing = list.find(
        (l) => l.id_unit === myUnit && String(l.tanggal).startsWith(todayStr)
      );
      if (!existing) return;
      if (existing.status === 'DRAFT') {
        loadDraftFromLaporan(existing);
        toast(t('laporan.draft_continue'), { icon: <Save size={18} color="var(--brand-500)" /> });
      } else {
        toast.error(t('laporan.duplicate_blocked'));
        navigate('/laporan/history');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    // Backstop: cegah laporan ganda hari yang sama (selain edit/resubmit).
    if (!draftLaporan.id_laporan) {
      const list = useLaporanStore.getState().laporanList || [];
      const myUnit = draftLaporan.id_unit || user?.id_unit;
      const clash = list.find(
        (l) => l.id_unit === myUnit && String(l.tanggal).startsWith(draftLaporan.tanggal) && l.status !== 'DRAFT'
      );
      if (clash) {
        toast.error(t('laporan.duplicate_blocked'));
        return;
      }
    }
    const success = await submitDraft();
    if (success) {
      setCurrentStep(3); // pindah ke step waiting
    }
  };

  const handleSimpanDraft = () => {
    setCurrentStep(1);
    toast.success(t('laporan.draft_saved'), { icon: <Save size={18} color="var(--brand-500)" /> });
  };

  const handleValidasi = () => {
    // Basic check: pastikan ada data yang diisi (bisa diperluas nanti)
    let hasData = false;
    if (unitName === 'Unit KNA') {
      hasData = draftLaporan.kna && Object.values(draftLaporan.kna).some(v => v !== '');
    } else if (unitName === 'Unit Angkutan Penumpang') {
      hasData = draftLaporan.penumpangItems && draftLaporan.penumpangItems.length > 0;
    } else if (unitName === 'Unit Angkutan Barang') {
      hasData = draftLaporan.barangItems && draftLaporan.barangItems.length > 0;
    } else if (unitName === 'Unit Keuangan') {
      hasData = draftLaporan.keuangan && (draftLaporan.keuangan.pendapatan !== '' || draftLaporan.keuangan.pengeluaran !== '');
    } else {
      hasData = true;
    }

    if (!hasData) {
      toast.error(t('laporan.validate_fail'));
      return;
    }

    setDraft({ status_internal: 'SELESAI' });
    setCurrentStep(2);
    toast.success(t('laporan.validate_success'), { icon: <ShieldCheck size={18} color="var(--brand-500)" /> });
  };

  const handleChangeKNA = (field, value) => {
    setDraft({
      kna: {
        ...(draftLaporan.kna || {}),
        [field]: value
      }
    });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="text-sm text-muted font-medium mb-1">{t('menu.laporan')} <span className="mx-1">&gt;</span> <span className="text-primary">{t('laporan.input_title')}</span></div>
        </div>
      </div>

      {/* Stepper */}
      <div className="card mb-6" style={{ marginBottom: '24px' }}>
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 w-full h-px bg-border" style={{ position: 'absolute', left: 0, top: '50%', width: '100%', height: '1px', background: 'var(--border)', zIndex: 0 }}></div>
          {steps.map((step, idx) => (
            <div key={step.id} className="relative z-10 flex items-center gap-3 bg-card px-4" style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-card)', padding: '0 16px' }}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                currentStep >= step.id 
                  ? 'bg-brand-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]' 
                  : 'bg-card-2 text-muted border border-border'
              }`} style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, 
                  background: currentStep >= step.id ? 'var(--brand-500)' : 'var(--bg-card-2)', 
                  color: currentStep >= step.id ? 'white' : 'var(--text-muted)',
                  boxShadow: currentStep >= step.id ? '0 0 12px rgba(99,102,241,0.4)' : 'none',
                  border: currentStep < step.id ? '1px solid var(--border)' : 'none'
              }}>
                {currentStep > step.id ? <CheckCircle2 size={16} /> : step.id}
              </div>
              <span className={`text-sm font-bold ${currentStep >= step.id ? 'text-primary' : 'text-muted'}`}>
                {step.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Header Laporan */}
      <div className="card mb-4" style={{ marginBottom: '24px', padding: '16px 24px' }}>
        <h4 className="font-bold mb-3 text-sm text-primary">{t('laporan.header_title')}</h4>
        <div className="grid grid-cols-3 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <input 
            type="text" 
            className="form-control bg-card-2 text-muted" 
            style={{ padding: '8px 12px' }}
            value={unitName || t('laporan.loading_unit')} 
            disabled 
          />
          <input 
            type="text" 
            className="form-control bg-card-2 text-muted" 
            style={{ padding: '8px 12px' }}
            value={t('laporan.daily_data')} 
            disabled 
          />
          <div
            className="form-control bg-card-2 text-muted"
            style={{ padding: '8px 12px' }}
          >
            {formatDate(draftLaporan.tanggal || todayStr, { day: '2-digit', month: 'short', year: 'numeric' }, i18n.language)}
          </div>
        </div>
      </div>

      {/* RENDER FORM DINAMIS BERDASARKAN UNIT */}
      {unitName === 'Unit Angkutan Penumpang' && <FormPenumpang draftLaporan={draftLaporan} setDraft={setDraft} />}
      {unitName === 'Unit Angkutan Barang' && <FormBarang draftLaporan={draftLaporan} setDraft={setDraft} ytdKomoditi={ytdKomoditi} />}
      {unitName === 'Unit Keuangan' && <FormKeuangan draftLaporan={draftLaporan} setDraft={setDraft} targetTahunan={targetTahunan} />}
      {unitName === 'Unit KNA' && <FormKNA draftLaporan={draftLaporan} handleChangeKNA={handleChangeKNA} targetTahunan={targetTahunan} />}

      {/* Catatan */}
      <div className="card mb-6" style={{ marginBottom: '24px' }}>
        <h3 className="section-title">{t('laporan.notes_title')}</h3>
        <textarea 
          className="form-control" 
          rows="3" 
          placeholder={t('laporan.notes_ph')}
          value={draftLaporan.kotak_detail || ''}
          onChange={(e) => setDraft({ kotak_detail: e.target.value })}
        ></textarea>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6 pt-4 border-t border-border" style={{ display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-secondary" onClick={handleSimpanDraft}>
          <Save size={18} /> {t('laporan.save_draft')}
        </button>
        <button className="btn btn-secondary" onClick={handleValidasi}>
          <ShieldCheck size={18} /> {t('laporan.validate')}
        </button>
        {currentStep >= 2 && (
          <button className="btn btn-primary" onClick={handleSubmit} disabled={isLoading}>
            <Send size={18} /> {isLoading ? t('laporan.saving') : t('laporan.submit')}
          </button>
        )}
      </div>
    </div>
  );
};

export default InputLaporan;
