import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { useTranslation } from 'react-i18next';

const DashboardPenumpang = ({ approvedLaporan }) => {
  const [chartDays, setChartDays] = useState(7);
  const { t } = useTranslation();

  const { totalJmlPenumpang, totalPendapatanPenumpang, perKaData } = useMemo(() => {
    let totalJml = 0;
    let totalPendapatan = 0;
    const kaMap = {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const cutoffDate = new Date(today);
    cutoffDate.setDate(today.getDate() - chartDays + 1);

    approvedLaporan.forEach(l => {
      const laporanDate = new Date(l.tanggal);
      laporanDate.setHours(0, 0, 0, 0);
      
      if (laporanDate >= cutoffDate) {
        if (l.laporan_penumpang && Array.isArray(l.laporan_penumpang)) {
          l.laporan_penumpang.forEach(p => {
            const jml = p.jml_penumpang ? parseInt(p.jml_penumpang) : 0;
            const pend = p.pendapatan ? parseFloat(p.pendapatan) : 0;
            const nama = p.nama_ka || 'Unknown';

            totalJml += jml;
            totalPendapatan += pend;

            if (!kaMap[nama]) {
              kaMap[nama] = { name: nama, Penumpang: 0, Pendapatan: 0 };
            }
            kaMap[nama].Penumpang += jml;
            kaMap[nama].Pendapatan += pend;
          });
        }
      }
    });

    const kaArray = Object.values(kaMap).sort((a, b) => b.Penumpang - a.Penumpang);
    return { totalJmlPenumpang: totalJml, totalPendapatanPenumpang: totalPendapatan, perKaData: kaArray };
  }, [approvedLaporan, chartDays]);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted text-sm mb-4 font-medium text-center">{t('penumpang.total_passengers')} ({chartDays} {t('dashboard.days')})</p>
          <h3 className="text-4xl font-bold text-gray-800 text-center">{totalJmlPenumpang.toLocaleString('id-ID')} <span className="text-xl font-normal">{t('dashboard.people')}</span></h3>
        </div>
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted text-sm mb-4 font-medium text-center">{t('penumpang.total_income')} ({chartDays} {t('dashboard.days')})</p>
          <h3 className="text-4xl font-bold text-gray-800 text-center">Rp {totalPendapatanPenumpang.toLocaleString('id-ID')}</h3>
        </div>
      </div>

      <div className="card mb-6" style={{ marginBottom: '24px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h3 className="font-semibold text-lg m-0 text-gray-800">{t('penumpang.comparison')}</h3>
            <p className="text-sm text-gray-500 m-0 mt-1">{t('penumpang.grouped_by')}</p>
          </div>
          <select value={chartDays} onChange={(e) => setChartDays(parseInt(e.target.value))} className="form-control" style={{ width: 'auto', padding: '4px 12px', height: 'auto' }}>
            <option value={7}>{t('dashboard.last_7_days')}</option>
            <option value={14}>{t('dashboard.last_14_days')}</option>
            <option value={30}>{t('dashboard.last_30_days')}</option>
          </select>
        </div>
        
        {perKaData.length > 0 ? (
          <div style={{ width: '100%', height: 300, marginBottom: '32px' }}>
            <ResponsiveContainer>
              <BarChart data={perKaData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" tickFormatter={(val) => Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(val)} width={60} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => `Rp ${Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(val)}`} width={80} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value, name) => [name.includes('Pendapatan') ? `Rp ${value.toLocaleString('id-ID')}` : value.toLocaleString('id-ID'), name]} cursor={{ fill: 'var(--bg-main)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)' }} />
                <Bar yAxisId="left" dataKey="Penumpang" name={t('penumpang.total_passengers')} fill="var(--brand-500)" radius={[4, 4, 0, 0]} barSize={40} />
                <Bar yAxisId="right" dataKey="Pendapatan" name={t('penumpang.total_income')} fill="var(--warning)" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-8 text-muted border border-dashed rounded-lg mb-6">{t('dashboard.no_data')}</div>
        )}

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{t('penumpang.ka_name')}</th>
                <th style={{ textAlign: 'right' }}>{t('penumpang.total_passengers')}</th>
                <th style={{ textAlign: 'right' }}>{t('penumpang.total_income')}</th>
              </tr>
            </thead>
            <tbody>
              {perKaData.map((ka) => (
                <tr key={ka.name}>
                  <td className="font-medium text-gray-800">{ka.name}</td>
                  <td style={{ textAlign: 'right' }}>{ka.Penumpang.toLocaleString('id-ID')} {t('dashboard.people')}</td>
                  <td style={{ textAlign: 'right', fontWeight: '500', color: '#16a34a' }}>Rp {ka.Pendapatan.toLocaleString('id-ID')}</td>
                </tr>
              ))}
              {perKaData.length === 0 && (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', padding: '24px' }}>{t('dashboard.no_data')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default DashboardPenumpang;
