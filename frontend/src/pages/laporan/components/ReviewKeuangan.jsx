import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber, formatDate, currencyPrefix } from '../../../utils/format';

const ReviewKeuangan = ({ laporan_keuangan }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const cur = currencyPrefix(lang);
  const trans = useMemo(() => {
    try { return JSON.parse(laporan_keuangan.rincian_transaksi || '[]') || []; } catch { return []; }
  }, [laporan_keuangan.rincian_transaksi]);

  const spj = useMemo(() => {
    try { return JSON.parse(laporan_keuangan.rincian_spj || '[]') || []; } catch { return []; }
  }, [laporan_keuangan.rincian_spj]);

  const invoice = useMemo(() => {
    try { return JSON.parse(laporan_keuangan.rincian_invoice || '[]') || []; } catch { return []; }
  }, [laporan_keuangan.rincian_invoice]);

  const labaRugi = (parseFloat(laporan_keuangan.pendapatan) || 0) - (parseFloat(laporan_keuangan.pengeluaran) || 0);

  return (
    <div className="card mb-4" style={{ marginBottom: '24px' }}>
      <h3 className="section-title">{t('laporan.review.keu_title')}</h3>
      
      <div className="table-wrapper mb-6">
        <table>
          <thead>
            <tr>
              <th>{t('laporan.review.keu_th_target')}</th>
              <th>{t('laporan.review.keu_th_real')}</th>
              <th>{t('laporan.review.keu_th_income')}</th>
              <th>{t('laporan.review.keu_th_expense')}</th>
              <th>{t('laporan.review.keu_th_profit')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{cur} {formatNumber(laporan_keuangan.target_rkad || 0, lang)}</td>
              <td>{cur} {formatNumber(laporan_keuangan.realisasi_rkad || 0, lang)}</td>
              <td className="text-green-600 font-medium">{cur} {formatNumber(laporan_keuangan.pendapatan || 0, lang)}</td>
              <td className="text-red-600 font-medium">{cur} {formatNumber(laporan_keuangan.pengeluaran || 0, lang)}</td>
              <td className={`font-bold ${labaRugi >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {cur} {formatNumber(labaRugi, lang)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {trans.length > 0 && (
        <div className="mb-6">
          <h4 className="font-bold text-gray-700 mb-2 text-sm uppercase">{t('laporan.review.keu_trans')}</h4>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="text-center">{t('laporan.review.keu_no')}</th>
                  <th>{t('laporan.review.keu_type')}</th>
                  <th>{t('laporan.review.keu_desc')}</th>
                  <th className="text-right">{t('laporan.review.keu_in')}</th>
                  <th className="text-right">{t('laporan.review.keu_out')}</th>
                  <th>{t('laporan.review.keu_unit')}</th>
                </tr>
              </thead>
              <tbody>
                {trans.map((tr, i) => (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td>{tr.jenis === 'Penerimaan' ? t('laporan.table.trx_in') : tr.jenis === 'Pembayaran' ? t('laporan.table.trx_out') : tr.jenis}</td>
                    <td>{tr.uraian}</td>
                    <td className="text-right">{formatNumber(parseFloat(tr.penerimaan || 0), lang)}</td>
                    <td className="text-right">{formatNumber(parseFloat(tr.pengeluaran || 0), lang)}</td>
                    <td>{tr.unit_kerja}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {spj.length > 0 && (
        <div className="mb-6">
          <h4 className="font-bold text-gray-700 mb-2 text-sm uppercase">{t('laporan.review.keu_spj')}</h4>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="text-center">{t('laporan.review.keu_no')}</th>
                  <th>{t('laporan.review.keu_spj_no')}</th>
                  <th>{t('laporan.review.keu_date')}</th>
                  <th>{t('laporan.review.keu_desc')}</th>
                  <th className="text-right">{t('laporan.review.keu_nominal')}</th>
                  <th>{t('laporan.review.keu_note')}</th>
                </tr>
              </thead>
              <tbody>
                {spj.map((s, i) => (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td>{s.no_spj}</td>
                    <td>{s.tanggal_spj ? formatDate(s.tanggal_spj, undefined, lang) : '-'}</td>
                    <td>{s.uraian}</td>
                    <td className="text-right">{formatNumber(parseFloat(s.nominal || 0), lang)}</td>
                    <td>{s.keterangan || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {invoice.length > 0 && (
        <div>
          <h4 className="font-bold text-gray-700 mb-2 text-sm uppercase">{t('laporan.review.keu_invoice')}</h4>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="text-center">{t('laporan.review.keu_no')}</th>
                  <th>{t('laporan.review.keu_inv_no')}</th>
                  <th>{t('laporan.review.keu_date')}</th>
                  <th>{t('laporan.review.keu_vendor')}</th>
                  <th className="text-right">{t('laporan.review.keu_nominal')}</th>
                  <th>{t('laporan.review.keu_due')}</th>
                  <th>{t('laporan.review.keu_status')}</th>
                  <th>{t('laporan.review.keu_note')}</th>
                </tr>
              </thead>
              <tbody>
                {invoice.map((inv, i) => (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td>{inv.no_invoice}</td>
                    <td>{inv.tanggal_invoice ? formatDate(inv.tanggal_invoice, undefined, lang) : '-'}</td>
                    <td>{inv.vendor}</td>
                    <td className="text-right">{formatNumber(parseFloat(inv.nominal || 0), lang)}</td>
                    <td>{inv.jatuh_tempo ? formatDate(inv.jatuh_tempo, undefined, lang) : '-'}</td>
                    <td>{inv.status === 'Belum Lunas' ? t('laporan.review.keu_unpaid') : inv.status === 'Lunas' ? t('laporan.table.inv_paid') : (inv.status || t('laporan.review.keu_unpaid'))}</td>
                    <td>{inv.keterangan || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default ReviewKeuangan;
