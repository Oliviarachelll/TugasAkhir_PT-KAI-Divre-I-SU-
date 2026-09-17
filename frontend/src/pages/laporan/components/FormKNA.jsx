import React from 'react';
import { useTranslation } from 'react-i18next';
import FormattedNumberInput from './FormattedNumberInput';
import { currencyPrefix } from '../../../utils/format';

const FormKNA = ({ draftLaporan, handleChangeKNA }) => {
  const { t, i18n } = useTranslation();
  const cur = currencyPrefix(i18n.language);
  const kna = draftLaporan.kna || {};

  return (
    <>
      <div className="card mb-4" style={{ marginBottom: '24px' }}>
        <h3 className="section-title">{t('laporan.form.daily_required')} <span className="text-danger">*</span></h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
          {/* Sub-A: Kontrak ROW */}
          <div>
            <h4 className="font-bold mb-3 text-sm text-muted">{t('laporan.form.kna_sub_a')}</h4>
            <div className="form-group">
              <label className="form-label">{t('laporan.form.kna_count_row')}</label>
              <FormattedNumberInput className="form-control" placeholder="0" value={kna.jml_kontrak_row ?? ''} onChange={(val) => handleChangeKNA('jml_kontrak_row', val)} />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">{t('laporan.form.kna_land_t_row')}</label>
                  <FormattedNumberInput className="form-control" placeholder="0" value={kna.luas_t_row ?? ''} onChange={(val) => handleChangeKNA('luas_t_row', val)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">{t('laporan.form.kna_build_b_row')}</label>
                  <FormattedNumberInput className="form-control" placeholder="0" value={kna.luas_b_row ?? ''} onChange={(val) => handleChangeKNA('luas_b_row', val)} />
                </div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('laporan.form.kna_value_row')}</label>
              <FormattedNumberInput className="form-control" placeholder="0" prefix={cur} value={kna.nilai_row ?? ''} onChange={(val) => handleChangeKNA('nilai_row', val)} />
            </div>
          </div>

          {/* Sub-B: Kontrak Non-ROW */}
          <div>
            <h4 className="font-bold mb-3 text-sm text-muted">{t('laporan.form.kna_sub_b')}</h4>
            <div className="form-group">
              <label className="form-label">{t('laporan.form.kna_count_non')}</label>
              <FormattedNumberInput className="form-control" placeholder="0" value={kna.jml_kontrak_non_row ?? ''} onChange={(val) => handleChangeKNA('jml_kontrak_non_row', val)} />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">{t('laporan.form.kna_land_t_non')}</label>
                  <FormattedNumberInput className="form-control" placeholder="0" value={kna.luas_t_non_row ?? ''} onChange={(val) => handleChangeKNA('luas_t_non_row', val)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">{t('laporan.form.kna_build_b_non')}</label>
                  <FormattedNumberInput className="form-control" placeholder="0" value={kna.luas_b_non_row ?? ''} onChange={(val) => handleChangeKNA('luas_b_non_row', val)} />
                </div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('laporan.form.kna_value_non')}</label>
              <FormattedNumberInput className="form-control" placeholder="0" prefix={cur} value={kna.nilai_non_row ?? ''} onChange={(val) => handleChangeKNA('nilai_non_row', val)} />
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4" style={{ marginBottom: '24px' }}>
        <h3 className="section-title">{t('laporan.form.kna_target_title')} <span className="text-danger">*</span></h3>
        <div className="form-grid-2">
          <div className="form-group mb-0">
            <label className="form-label">{t('laporan.form.kna_target')}</label>
            <FormattedNumberInput className="form-control" placeholder="0" prefix={cur} value={kna.target_rkad ?? ''} onChange={(val) => handleChangeKNA('target_rkad', val)} />
          </div>
          <div className="form-group mb-0">
            <label className="form-label">{t('laporan.form.kna_realization')}</label>
            <FormattedNumberInput className="form-control" placeholder="0" prefix={cur} value={kna.realisasi_rkad ?? ''} onChange={(val) => handleChangeKNA('realisasi_rkad', val)} />
          </div>
        </div>
      </div>
    </>
  );
};

export default FormKNA;
