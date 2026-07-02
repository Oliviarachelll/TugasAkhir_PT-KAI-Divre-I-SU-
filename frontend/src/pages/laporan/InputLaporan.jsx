import React, { useState, useEffect } from 'react';
import { CheckCircle2, Save, Send, ShieldCheck, Trash2 } from 'lucide-react';
import useLaporanStore from '../../store/laporan.store';
import useAuthStore from '../../store/auth.store';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import FormKNA from './components/FormKNA';
import FormBarang from './components/FormBarang';
import FormPenumpang from './components/FormPenumpang';
import FormKeuangan from './components/FormKeuangan';

const steps = [
  { id: 1, name: 'DRAFT', status: 'current' },
  { id: 2, name: 'READY TO SUBMIT', status: 'upcoming' },
  { id: 3, name: 'WAITING', status: 'upcoming' },
];

const InputLaporan = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const { draftLaporan, setDraft, submitDraft, isLoading } = useLaporanStore();
  const { user } = useAuthStore();
  const { t } = useTranslation();

  const unitName = user?.unit?.nama_unit || '';

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

  const handleSubmit = async () => {
    const success = await submitDraft();
    if (success) {
      setCurrentStep(3); // pindah ke step waiting
    }
  };

  const handleSimpanDraft = () => {
    setCurrentStep(1);
    toast.success('Draft berhasil disimpan secara lokal!', { icon: <Save size={18} color="var(--brand-500)" /> });
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
      toast.error('Gagal validasi: Data laporan masih kosong!');
      return;
    }

    setDraft({ status_internal: 'SELESAI' });
    setCurrentStep(2);
    toast.success('Validasi sukses! Data siap untuk disubmit.', { icon: <ShieldCheck size={18} color="var(--brand-500)" /> });
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
        <h4 className="font-bold mb-3 text-sm text-primary">Header Laporan</h4>
        <div className="grid grid-cols-3 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <input 
            type="text" 
            className="form-control bg-card-2 text-muted" 
            style={{ padding: '8px 12px' }}
            value={unitName || 'Loading...'} 
            disabled 
          />
          <input 
            type="text" 
            className="form-control bg-card-2 text-muted" 
            style={{ padding: '8px 12px' }}
            value="Data Harian" 
            disabled 
          />
          <input 
            type="date" 
            className="form-control" 
            style={{ padding: '8px 12px' }}
            value={draftLaporan.tanggal} 
            onChange={(e) => setDraft({ tanggal: e.target.value })} 
          />
        </div>
      </div>

      {/* RENDER FORM DINAMIS BERDASARKAN UNIT */}
      {unitName === 'Unit Angkutan Penumpang' && <FormPenumpang draftLaporan={draftLaporan} setDraft={setDraft} />}
      {unitName === 'Unit Angkutan Barang' && <FormBarang draftLaporan={draftLaporan} setDraft={setDraft} />}
      {unitName === 'Unit Keuangan' && <FormKeuangan draftLaporan={draftLaporan} setDraft={setDraft} />}
      {unitName === 'Unit KNA' && <FormKNA draftLaporan={draftLaporan} handleChangeKNA={handleChangeKNA} />}

      {/* Catatan */}
      <div className="card mb-6" style={{ marginBottom: '24px' }}>
        <h3 className="section-title">Catatan Tambahan / Kotak Detail (opsional)</h3>
        <textarea 
          className="form-control" 
          rows="3" 
          placeholder="Tambahkan catatan untuk Admin Global..."
          value={draftLaporan.kotak_detail || ''}
          onChange={(e) => setDraft({ kotak_detail: e.target.value })}
        ></textarea>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6 pt-4 border-t border-border" style={{ display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-secondary" onClick={handleSimpanDraft}>
          <Save size={18} /> Simpan Draft
        </button>
        <button className="btn btn-secondary" onClick={handleValidasi}>
          <ShieldCheck size={18} /> Validasi Internal
        </button>
        {currentStep >= 2 && (
          <button className="btn btn-primary" onClick={handleSubmit} disabled={isLoading}>
            <Send size={18} /> {isLoading ? 'Menyimpan...' : t('laporan.submit')}
          </button>
        )}
      </div>
    </div>
  );
};

export default InputLaporan;
