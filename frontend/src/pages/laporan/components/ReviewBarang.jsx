import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber, currencyPrefix } from '../../../utils/format';

const ReviewBarang = ({ laporan_barang }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const cur = currencyPrefix(lang);
  const tonUnit = t('dashboard.ton');
  const rincianItems = laporan_barang.filter(item => item.id_komoditi !== 99);
  let totalItem = laporan_barang.find(item => item.id_komoditi === 99);
  if (!totalItem && rincianItems.length > 0) {
    let autoVolume = 0;
    let autoPendapatan = 0;
    rincianItems.forEach(b => {
      autoVolume += parseFloat(b.volume) || 0;
      autoPendapatan += parseFloat(b.pendapatan) || 0;
    });
    totalItem = { volume: autoVolume, pendapatan: autoPendapatan };
  }

  // Hitung total Jml KA dari rincian
  const totalJmlKa = rincianItems.reduce((acc, curr) => acc + (parseInt(curr.jml_ka) || 0), 0);

  return (
    <div className="card mb-4">
      <h3 className="section-title">{t('laporan.review.barang_title')}</h3>
      
      {/* SECTION 1: Total KA, VOL, & PENDAPATAN */}
      <div className="mb-6">
        <h4 className="font-semibold text-sm mb-3 text-slate-700 dark:text-slate-300">
          {t('laporan.review.barang_total')}
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '16px' }} className="md:grid-cols-1 lg:grid-cols-4">
          
          {/* Left: Jml KA per Komoditi */}
          <div className="table-wrapper lg:col-span-1">
            <table className="text-sm">
              <thead>
                <tr>
                  <th>{t('laporan.review.barang_commodity')}</th>
                  <th className="text-center">{t('laporan.review.barang_ka_count')}</th>
                </tr>
              </thead>
              <tbody>
                {rincianItems.map((item, i) => (
                  <tr key={i}>
                    <td>
                      {item.komoditi?.nama_komoditi || 'N/A'}
                      {item.nama_kustom ? ` - ${item.nama_kustom}` : ''}
                    </td>
                    <td className="text-center font-medium">
                      {item.jml_ka || 0} {item.id_komoditi === 15 ? 'B' : 'KA'}
                    </td>
                  </tr>
                ))}
                <tr style={{ backgroundColor: 'var(--bg-main)', fontWeight: 'bold' }}>
                  <td>{t('laporan.review.barang_total_row')}</td>
                  <td className="text-center text-primary">{totalJmlKa} KA</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Right: Total Volume & Pendapatan */}
          {totalItem && (
            <div className="table-wrapper lg:col-span-3">
              <table className="text-sm">
                <thead>
                  <tr>
                    <th>{t('laporan.review.barang_col_total')}</th>
                    <th>{t('laporan.review.barang_col_daily')}</th>
                    <th>{t('laporan.review.barang_col_cum')}</th>
                    <th>{t('laporan.review.barang_col_prog')}</th>
                    <th>{t('laporan.review.barang_col_ach')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-semibold text-slate-600">{t('laporan.review.barang_volume')}</td>
                    <td className="font-medium">{totalItem.volume ? formatNumber(parseFloat(totalItem.volume), lang) : 0} {tonUnit}</td>
                    <td className="font-medium">{totalItem.volume_kumulatif ? formatNumber(parseFloat(totalItem.volume_kumulatif), lang) : 0} {tonUnit}</td>
                    <td className="font-medium">{totalItem.volume_program ? formatNumber(parseFloat(totalItem.volume_program), lang) : 0} {tonUnit}</td>
                    <td className="font-medium text-info">{totalItem.volume_pencapaian ? formatNumber(parseFloat(totalItem.volume_pencapaian), lang) : 0} %</td>
                  </tr>
                  <tr>
                    <td className="font-semibold text-slate-600">{t('laporan.review.barang_income')}</td>
                    <td className="text-success font-medium">{cur} {totalItem.pendapatan ? formatNumber(parseFloat(totalItem.pendapatan), lang) : 0}</td>
                    <td className="text-success font-medium">{cur} {totalItem.pendapatan_kumulatif ? formatNumber(parseFloat(totalItem.pendapatan_kumulatif), lang) : 0}</td>
                    <td className="text-success font-medium">{cur} {totalItem.pendapatan_program ? formatNumber(parseFloat(totalItem.pendapatan_program), lang) : 0}</td>
                    <td className="text-info font-medium">{totalItem.pendapatan_pencapaian ? formatNumber(parseFloat(totalItem.pendapatan_pencapaian), lang) : 0} %</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: Rincian Barang (Without Jml KA) */}
      <div>
        <h4 className="font-semibold text-sm mb-3 text-slate-700 dark:text-slate-300">{t('laporan.review.barang_detail')}</h4>
        <div className="table-wrapper">
          <table className="text-xs">
            <thead>
              <tr>
                <th>{t('laporan.review.barang_commodity')}</th>
                <th>{t('laporan.review.barang_h_vol')}</th>
                <th>{t('laporan.review.barang_k_vol')}</th>
                <th>{t('laporan.review.barang_p_vol')}</th>
                <th>{t('laporan.review.barang_col_ach')}</th>
                <th>{t('laporan.review.barang_h_pdt')}</th>
                <th>{t('laporan.review.barang_k_pdt')}</th>
                <th>{t('laporan.review.barang_p_pdt')}</th>
                <th>{t('laporan.review.barang_col_ach')}</th>
              </tr>
            </thead>
            <tbody>
              {rincianItems.map((item, i) => (
                <tr key={i}>
                  <td className="font-medium">
                    {item.komoditi?.nama_komoditi || 'N/A'}
                    {item.nama_kustom ? ` - ${item.nama_kustom}` : ''}
                  </td>
                  <td>{item.volume ? formatNumber(parseFloat(item.volume), lang) : 0} {tonUnit}</td>
                  <td>{item.volume_kumulatif ? formatNumber(parseFloat(item.volume_kumulatif), lang) : 0} {tonUnit}</td>
                  <td>{item.volume_program ? formatNumber(parseFloat(item.volume_program), lang) : 0} {tonUnit}</td>
                  <td className="text-info font-medium">{item.volume_pencapaian ? formatNumber(parseFloat(item.volume_pencapaian), lang) : 0}%</td>
                  <td className="text-success">{cur} {item.pendapatan ? formatNumber(parseFloat(item.pendapatan), lang) : 0}</td>
                  <td className="text-success">{cur} {item.pendapatan_kumulatif ? formatNumber(parseFloat(item.pendapatan_kumulatif), lang) : 0}</td>
                  <td className="text-success">{cur} {item.pendapatan_program ? formatNumber(parseFloat(item.pendapatan_program), lang) : 0}</td>
                  <td className="text-info font-medium">{item.pendapatan_pencapaian ? formatNumber(parseFloat(item.pendapatan_pencapaian), lang) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReviewBarang;
