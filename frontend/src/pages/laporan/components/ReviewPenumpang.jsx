import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber, currencyPrefix } from '../../../utils/format';

const ReviewPenumpang = ({ laporan_penumpang }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const cur = currencyPrefix(lang);
  return (
    <div className="card mb-4">
      <h3 className="section-title">{t('laporan.review.pnp_title')}</h3>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>{t('laporan.review.pnp_name')}</th>
              <th>{t('laporan.review.pnp_count')}</th>
              <th>{t('laporan.review.pnp_income')}</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(
              laporan_penumpang.reduce((acc, curr) => {
                if (!acc[curr.nama_ka]) acc[curr.nama_ka] = { nama_ka: curr.nama_ka, jml_penumpang: 0, pendapatan: 0 };
                acc[curr.nama_ka].jml_penumpang += curr.jml_penumpang;
                acc[curr.nama_ka].pendapatan += parseFloat(curr.pendapatan || 0);
                return acc;
              }, {})
            ).map((item, i) => (
              <tr key={i}>
                <td className="font-medium">{item.nama_ka || '-'}</td>
                <td>{item.jml_penumpang ? formatNumber(item.jml_penumpang, lang) : 0}</td>
                <td className="text-success font-bold">{cur} {item.pendapatan ? formatNumber(item.pendapatan, lang) : 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReviewPenumpang;
