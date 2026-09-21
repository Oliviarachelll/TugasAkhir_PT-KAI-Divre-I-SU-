import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import FormattedNumberInput from './FormattedNumberInput';
import TableRincianTransaksi from './TableRincianTransaksi';
import TableSPJ from './TableSPJ';
import TableInvoice from './TableInvoice';
import { formatNumber, currencyPrefix } from '../../../utils/format';

const FormKeuangan = ({ draftLaporan, setDraft, targetTahunan = null, previewRealisasi = null }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const cur = currencyPrefix(lang);
  const hasMasterTarget = targetTahunan !== null && targetTahunan !== undefined;
  const targetRkad = draftLaporan.keuangan?.target_rkad || '';
  const realisasiRkad = draftLaporan.keuangan?.realisasi_rkad || '';
  
  const rincianTransaksi = draftLaporan.keuangan?.rincian_transaksi || '[]';
  const rincianSPJ = draftLaporan.keuangan?.rincian_spj || '[]';
  const rincianInvoice = draftLaporan.keuangan?.rincian_invoice || '[]';

  // Parse transaksi to calculate totals
  const parsedTransaksi = useMemo(() => {
    try { return JSON.parse(rincianTransaksi) || []; } catch { return []; }
  }, [rincianTransaksi]);

  const computedPendapatan = parsedTransaksi.reduce((acc, curr) => acc + (parseFloat(curr.penerimaan) || 0), 0);
  const computedPengeluaran = parsedTransaksi.reduce((acc, curr) => acc + (parseFloat(curr.pengeluaran) || 0), 0);
  const labaRugi = computedPendapatan - computedPengeluaran;

  const handleChangeKeuangan = (field, value) => {
    setDraft(prev => {
      const newKeuangan = {
        ...(prev.keuangan || {}),
        [field]: value
      };
      
      // If we are updating rincian_transaksi, we should also update the totals immediately
      if (field === 'rincian_transaksi') {
        try {
          const trans = JSON.parse(value) || [];
          const pend = trans.reduce((acc, curr) => acc + (parseFloat(curr.penerimaan) || 0), 0);
          const peng = trans.reduce((acc, curr) => acc + (parseFloat(curr.pengeluaran) || 0), 0);
          newKeuangan.pendapatan = pend.toString();
          newKeuangan.pengeluaran = peng.toString();
        } catch(e) {}
      }

      return {
        ...prev,
        keuangan: newKeuangan
      };
    });
  };

  // Target tahunan master otomatis mengisi field. Draft BARU selalu ikut master
  // terbaru (field read-only); draft lama/edit dipertahankan, kecuali masih kosong.
  const isNewKeu = !draftLaporan.id_laporan;
  useEffect(() => {
    if (!hasMasterTarget) return;
    const empty = targetRkad === '' || targetRkad === null || targetRkad === undefined;
    if ((isNewKeu || empty) && Number(targetRkad) !== Number(targetTahunan)) {
      handleChangeKeuangan('target_rkad', Number(targetTahunan));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMasterTarget, targetTahunan, isNewKeu]);

  return (
    <div className="card mb-4" style={{ marginBottom: '24px' }}>
      <h3 className="section-title">{t('laporan.form.keu_title')}</h3>
      
      <div className="form-grid-2 mb-6">
        <div className="form-group">
          <label className="form-label">{t('laporan.form.keu_target')}</label>
          <div className="form-control bg-card-2 text-muted" style={{ padding: '8px 12px' }}>
            {cur} {formatNumber(targetRkad === '' ? 0 : targetRkad, lang)}
          </div>
          {!hasMasterTarget && (
            <p className="mt-1 text-xs" style={{ color: 'var(--warning)' }}>{t('dashboard.target_missing')}</p>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">{t('laporan.form.keu_realization')}</label>
          <div className="form-control bg-card-2 text-muted" style={{ padding: '8px 12px' }}>
            {cur} {formatNumber(previewRealisasi ?? (realisasiRkad === '' ? 0 : realisasiRkad), lang)}
          </div>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{t('laporan.form.realisasi_auto')}</p>
        </div>
      </div>

      <TableRincianTransaksi 
        data={rincianTransaksi} 
        onChange={(val) => handleChangeKeuangan('rincian_transaksi', val)} 
      />

      <TableSPJ 
        data={rincianSPJ} 
        onChange={(val) => handleChangeKeuangan('rincian_spj', val)} 
      />

      <TableInvoice 
        data={rincianInvoice} 
        onChange={(val) => handleChangeKeuangan('rincian_invoice', val)} 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div className="form-group p-4 rounded bg-gray-50 border border-gray-200">
          <label className="form-label mb-1">{t('laporan.form.keu_income_auto')}</label>
          <p className="text-xl font-bold text-green-700">
            {cur} {formatNumber(computedPendapatan, lang)}
          </p>
        </div>
        <div className="form-group p-4 rounded bg-gray-50 border border-gray-200">
          <label className="form-label mb-1">{t('laporan.form.keu_expense_auto')}</label>
          <p className="text-xl font-bold text-red-700">
            {cur} {formatNumber(computedPengeluaran, lang)}
          </p>
        </div>
      </div>

      <div className="form-group mt-6 p-6 rounded-lg bg-white border-2 border-orange-400 flex flex-col md:flex-row justify-between items-center shadow-sm">
        <div>
          <h4 className="text-sm font-bold text-blue-900 mb-2 uppercase tracking-wide">{t('laporan.form.keu_result')}</h4>
          <p className={`text-md mb-1 font-medium ${labaRugi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {labaRugi >= 0 ? t('laporan.form.keu_profit') : t('laporan.form.keu_loss')}
          </p>
          <p className={`text-3xl font-bold ${labaRugi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {cur} {formatNumber(Math.abs(labaRugi), lang)}
          </p>
        </div>
        <div className="mt-4 md:mt-0 text-left md:text-right">
          <p className="text-sm text-blue-900 mb-1 font-medium">{t('laporan.form.keu_formula')}</p>
          <p className="text-md text-blue-900 mb-1">
            {formatNumber(computedPendapatan, lang)} - {formatNumber(computedPengeluaran, lang)}
          </p>
          <p className={`text-lg font-bold ${labaRugi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            = {labaRugi >= 0 ? '' : '-'}{formatNumber(Math.abs(labaRugi), lang)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default FormKeuangan;
