import React, { useState } from 'react';
import { CheckCircle2, ChevronRight, Save, Send, ShieldCheck } from 'lucide-react';

const steps = [
  { id: 1, name: 'DRAFT', status: 'current' },
  { id: 2, name: 'READY TO SUBMIT', status: 'upcoming' },
  { id: 3, name: 'WAITING', status: 'upcoming' },
];

const InputLaporan = () => {
  const [currentStep, setCurrentStep] = useState(1);

  // Form A: Data Harian
  const renderFormA = () => (
    <div className="card mb-4" style={{ marginBottom: '24px' }}>
      <h3 className="section-title">Data Harian *</h3>
      <div className="table-wrapper mb-4">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Kolom A</th>
              <th>Kolom B (Satuan)</th>
              <th>Kolom C (Rp)</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map(i => (
              <tr key={i}>
                <td>Item {i}</td>
                <td><input type="number" className="form-control form-control-sm" placeholder="0" /></td>
                <td><input type="number" className="form-control form-control-sm" placeholder="0.0" /></td>
                <td><input type="number" className="form-control form-control-sm" placeholder="0" /></td>
              </tr>
            ))}
            <tr>
              <td colSpan={4}>
                <button className="btn btn-secondary btn-sm">+ Tambah Item</button>
              </td>
            </tr>
            <tr style={{ background: 'var(--bg-card-2)' }}>
              <td className="font-bold text-primary">TOTAL HARIAN</td>
              <td className="font-bold text-primary">—</td>
              <td className="font-bold text-primary">—</td>
              <td className="font-bold text-primary">—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  // Form B: Data Kumulatif & Target
  const renderFormB = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
      <div className="card">
        <h3 className="section-title">Data Kumulatif *</h3>
        <div className="form-group">
          <label className="form-label">Total Nilai Kumulatif (Satuan)</label>
          <input type="number" className="form-control" placeholder="0.0" />
        </div>
        <div className="form-group mb-0">
          <label className="form-label">Total Nilai Kumulatif (Rp)</label>
          <input type="number" className="form-control" placeholder="0" />
          <p className="form-error text-muted mt-1">Akumulasi periode berjalan</p>
        </div>
      </div>
      
      <div className="card">
        <h3 className="section-title">Target vs Realisasi *</h3>
        <div className="form-group">
          <label className="form-label">Target (Satuan)</label>
          <input type="number" className="form-control" placeholder="0.0" />
        </div>
        <div className="form-group">
          <label className="form-label">Realisasi (Satuan)</label>
          <input type="number" className="form-control" placeholder="0.0" />
        </div>
        <div className="mt-4">
          <label className="form-label text-xs">Persentase (auto)</label>
          <div className="text-2xl font-bold text-primary mb-2">00%</div>
          <div style={{ width: '100%', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: '0%', height: '100%', background: 'var(--brand-500)' }}></div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Input Laporan Harian</h2>
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
      <div className="card mb-4" style={{ marginBottom: '24px' }}>
        <h3 className="section-title">Header Laporan</h3>
        <div className="form-grid-3">
          <div className="form-group mb-0">
            <label className="form-label">Nama Unit</label>
            <input type="text" className="form-control bg-input opacity-70" value="Unit DAOP 1" disabled />
          </div>
          <div className="form-group mb-0">
            <label className="form-label">Jenis Laporan</label>
            <select className="form-control">
              <option>Data Harian</option>
              <option>Data Penumpang</option>
            </select>
          </div>
          <div className="form-group mb-0">
            <label className="form-label">Tanggal</label>
            <input type="date" className="form-control" defaultValue={new Date().toISOString().split('T')[0]} />
          </div>
        </div>
      </div>

      {renderFormA()}
      {renderFormB()}

      {/* Catatan */}
      <div className="card mb-6" style={{ marginBottom: '24px' }}>
        <h3 className="section-title">Catatan (opsional)</h3>
        <textarea className="form-control" rows="3" placeholder="Tambahkan catatan jika diperlukan..."></textarea>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6 pt-4 border-t border-border" style={{ display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-secondary" onClick={() => setCurrentStep(1)}>
          <Save size={18} /> Simpan Draft
        </button>
        <button className="btn btn-secondary" onClick={() => setCurrentStep(2)}>
          <ShieldCheck size={18} /> Validasi Internal
        </button>
        <button className="btn btn-primary" onClick={() => setCurrentStep(3)}>
          <Send size={18} /> Submit Laporan
        </button>
      </div>
    </div>
  );
};

export default InputLaporan;
