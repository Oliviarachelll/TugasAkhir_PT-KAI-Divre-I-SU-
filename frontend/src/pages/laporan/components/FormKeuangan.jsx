import React from 'react';
import FormattedNumberInput from './FormattedNumberInput';

const FormKeuangan = ({ draftLaporan, setDraft }) => {
  const pend = draftLaporan.keuangan?.pendapatan || '';
  const peng = draftLaporan.keuangan?.pengeluaran || '';
  const labaRugi = (parseFloat(pend) || 0) - (parseFloat(peng) || 0);

  const handleChangeKeuangan = (field, value) => {
    setDraft({
      keuangan: {
        ...(draftLaporan.keuangan || {}),
        [field]: value
      }
    });
  };

  return (
    <div className="card mb-4" style={{ marginBottom: '24px' }}>
      <h3 className="section-title">Laporan Keuangan</h3>
      <div className="form-grid-2">
        <div className="form-group">
          <label className="form-label">Total Pendapatan (Rp)</label>
          <FormattedNumberInput className="form-control" placeholder="0" value={pend} onChange={(val) => handleChangeKeuangan('pendapatan', val)} />
        </div>
        <div className="form-group">
          <label className="form-label">Total Pengeluaran (Rp)</label>
          <FormattedNumberInput className="form-control" placeholder="0" value={peng} onChange={(val) => handleChangeKeuangan('pengeluaran', val)} />
        </div>
      </div>
      <div className="form-group mt-4 p-4 rounded bg-input border border-border">
        <label className="form-label mb-1">Laba / Rugi Bersih</label>
        <p className={`text-xl font-bold ${labaRugi >= 0 ? 'text-success' : 'text-danger'}`}>
          Rp {labaRugi.toLocaleString('id-ID')}
        </p>
      </div>
    </div>
  );
};

export default FormKeuangan;
