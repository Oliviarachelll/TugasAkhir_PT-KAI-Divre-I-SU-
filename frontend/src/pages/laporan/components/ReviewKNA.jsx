import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber, currencyPrefix } from '../../../utils/format';

const ReviewKNA = ({ laporan_kna }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const cur = currencyPrefix(lang);
  return (
    <div className="card mb-4">
      <h3 className="section-title">{t('laporan.review.kna_title')}</h3>
      
      <h4 className="font-bold text-sm text-primary mb-2 mt-4">{t('laporan.review.kna_rkad')}</h4>
      <div className="table-wrapper mb-4">
        <table>
          <thead>
            <tr>
              <th>{t('laporan.review.kna_target')}</th>
              <th>{t('laporan.review.kna_real')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-lg">{cur} {formatNumber(laporan_kna.target_rkad || 0, lang)}</td>
              <td className="text-lg">{cur} {formatNumber(laporan_kna.realisasi_rkad || 0, lang)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h4 className="font-bold text-sm text-primary mb-2 mt-4">{t('laporan.review.kna_row')}</h4>
      <div className="table-wrapper mb-4">
        <table>
          <thead>
            <tr>
              <th>{t('laporan.review.kna_count')}</th>
              <th>{t('laporan.review.kna_land_t')}</th>
              <th>{t('laporan.review.kna_land_b')}</th>
              <th>{t('laporan.review.kna_value')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-lg font-medium">{laporan_kna.jml_kontrak_row || 0}</td>
              <td className="text-lg">{formatNumber(laporan_kna.luas_t_row || 0, lang)}</td>
              <td className="text-lg">{formatNumber(laporan_kna.luas_b_row || 0, lang)}</td>
              <td className="text-lg text-brand-500 font-bold">{cur} {formatNumber(laporan_kna.nilai_row || 0, lang)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h4 className="font-bold text-sm text-primary mb-2 mt-4">{t('laporan.review.kna_non')}</h4>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>{t('laporan.review.kna_count')}</th>
              <th>{t('laporan.review.kna_land_t')}</th>
              <th>{t('laporan.review.kna_land_b')}</th>
              <th>{t('laporan.review.kna_value')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-lg font-medium">{laporan_kna.jml_kontrak_non_row || 0}</td>
              <td className="text-lg">{formatNumber(laporan_kna.luas_t_non_row || 0, lang)}</td>
              <td className="text-lg">{formatNumber(laporan_kna.luas_b_non_row || 0, lang)}</td>
              <td className="text-lg text-brand-500 font-bold">{cur} {formatNumber(laporan_kna.nilai_non_row || 0, lang)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReviewKNA;
