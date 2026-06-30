import React from 'react';
import FormattedNumberInput from './FormattedNumberInput';

const FormKNA = ({ draftLaporan, handleChangeKNA }) => {
  const kna = draftLaporan.kna || {};

  return (
    <>
      <div className="card mb-4" style={{ marginBottom: '24px' }}>
        <h3 className="section-title">Data Harian <span className="text-danger">*</span></h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
          {/* Sub-A: Kontrak ROW */}
          <div>
            <h4 className="font-bold mb-3 text-sm text-muted">Sub-A: Kontrak ROW</h4>
            <div className="form-group">
              <label className="form-label">Jumlah Kontrak ROW</label>
              <FormattedNumberInput className="form-control" placeholder="0" value={kna.jml_kontrak_row ?? ''} onChange={(val) => handleChangeKNA('jml_kontrak_row', val)} />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Luas T ROW (m²)</label>
                  <FormattedNumberInput className="form-control" placeholder="0" value={kna.luas_t_row ?? ''} onChange={(val) => handleChangeKNA('luas_t_row', val)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Luas B ROW (m²)</label>
                  <FormattedNumberInput className="form-control" placeholder="0" value={kna.luas_b_row ?? ''} onChange={(val) => handleChangeKNA('luas_b_row', val)} />
                </div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Nilai ROW (Rp)</label>
              <FormattedNumberInput className="form-control" placeholder="0" value={kna.nilai_row ?? ''} onChange={(val) => handleChangeKNA('nilai_row', val)} />
            </div>
          </div>

          {/* Sub-B: Kontrak Non-ROW */}
          <div>
            <h4 className="font-bold mb-3 text-sm text-muted">Sub-B: Kontrak Non-ROW</h4>
            <div className="form-group">
              <label className="form-label">Jumlah Kontrak Non-ROW</label>
              <FormattedNumberInput className="form-control" placeholder="0" value={kna.jml_kontrak_non_row ?? ''} onChange={(val) => handleChangeKNA('jml_kontrak_non_row', val)} />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Luas T Non-ROW (m²)</label>
                  <FormattedNumberInput className="form-control" placeholder="0" value={kna.luas_t_non_row ?? ''} onChange={(val) => handleChangeKNA('luas_t_non_row', val)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Luas B Non-ROW (m²)</label>
                  <FormattedNumberInput className="form-control" placeholder="0" value={kna.luas_b_non_row ?? ''} onChange={(val) => handleChangeKNA('luas_b_non_row', val)} />
                </div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Nilai Non-ROW (Rp)</label>
              <FormattedNumberInput className="form-control" placeholder="0" value={kna.nilai_non_row ?? ''} onChange={(val) => handleChangeKNA('nilai_non_row', val)} />
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4" style={{ marginBottom: '24px' }}>
        <h3 className="section-title">Target vs Realisasi <span className="text-danger">*</span></h3>
        <div className="form-grid-2">
          <div className="form-group mb-0">
            <label className="form-label">Target RKAD (Rp)</label>
            <FormattedNumberInput className="form-control" placeholder="0" value={kna.target_rkad ?? ''} onChange={(val) => handleChangeKNA('target_rkad', val)} />
          </div>
          <div className="form-group mb-0">
            <label className="form-label">Realisasi RKAD (Rp)</label>
            <FormattedNumberInput className="form-control" placeholder="0" value={kna.realisasi_rkad ?? ''} onChange={(val) => handleChangeKNA('realisasi_rkad', val)} />
          </div>
        </div>
      </div>
    </>
  );
};

export default FormKNA;
