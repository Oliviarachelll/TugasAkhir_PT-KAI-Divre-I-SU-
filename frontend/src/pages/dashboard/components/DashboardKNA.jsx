import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { useTranslation } from 'react-i18next';

const DashboardKNA = ({ laporanList, approvedLaporan }) => {
  const [chartDays, setChartDays] = useState(7);
  const { t } = useTranslation();

  // Target RKAD (Khusus KNA)
  const latestLaporanKNA = useMemo(() => {
    const found = laporanList.find(l => l.laporan_kna);
    return found ? found.laporan_kna : null;
  }, [laporanList]);

  const targetRKAD = latestLaporanKNA?.target_rkad ? parseFloat(latestLaporanKNA.target_rkad) : 0;

  // Kalkulasi Akumulasi KNA
  let realisasiRKAD = 0;
  let totalLuasTanahRow = 0;
  let totalLuasBangunanRow = 0;
  let totalLuasTanahNonRow = 0;
  let totalLuasBangunanNonRow = 0;
  let totalKontrakRow = 0;
  let totalKontrakNonRow = 0;

  approvedLaporan.forEach(l => {
    if (l.laporan_kna) {
      const kna = l.laporan_kna;
      realisasiRKAD += kna.realisasi_rkad ? parseFloat(kna.realisasi_rkad) : 0;
      totalLuasTanahRow += kna.luas_t_row ? parseFloat(kna.luas_t_row) : 0;
      totalLuasBangunanRow += kna.luas_b_row ? parseFloat(kna.luas_b_row) : 0;
      totalLuasTanahNonRow += kna.luas_t_non_row ? parseFloat(kna.luas_t_non_row) : 0;
      totalLuasBangunanNonRow += kna.luas_b_non_row ? parseFloat(kna.luas_b_non_row) : 0;
      totalKontrakRow += kna.jml_kontrak_row ? parseInt(kna.jml_kontrak_row) : 0;
      totalKontrakNonRow += kna.jml_kontrak_non_row ? parseInt(kna.jml_kontrak_non_row) : 0;
    }
  });

  const persentaseKNA = targetRKAD > 0 ? ((realisasiRKAD / targetRKAD) * 100).toFixed(1) : 0;

  const donutDataKNA = [
    { name: 'Realisasi', value: realisasiRKAD },
    { name: 'Sisa Target', value: Math.max(0, targetRKAD - realisasiRKAD) }
  ];
  const donutColors = ['var(--chart-bar-primary)', 'var(--chart-grid)'];

  const chartData = useMemo(() => {
    const data = [];
    let today = new Date();
    if (approvedLaporan.length > 0) {
      const dates = approvedLaporan.map(l => new Date(l.tanggal).getTime());
      today = new Date(Math.max(...dates));
    }
    
    for (let i = chartDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const laporanHariIni = approvedLaporan.filter(l => l.tanggal.startsWith(dateStr) && l.laporan_kna);
      
      let sumROW = 0;
      let sumNonROW = 0;
      laporanHariIni.forEach(l => {
        sumROW += l.laporan_kna.nilai_row ? parseFloat(l.laporan_kna.nilai_row) : 0;
        sumNonROW += l.laporan_kna.nilai_non_row ? parseFloat(l.laporan_kna.nilai_non_row) : 0;
      });
      data.push({
        name: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        ROW: sumROW,
        NonROW: sumNonROW
      });
    }
    return data;
  }, [approvedLaporan, chartDays]);

  const knaSummary = useMemo(() => {
    if (chartData.length === 0) return { max: 'Rp 0', min: 'Rp 0', avg: 'Rp 0', growth: '0%' };
    const dailyTotals = chartData.map(d => (d.ROW || 0) + (d.NonROW || 0));
    const nonZeroTotals = dailyTotals.filter(t => t > 0);
    const max = dailyTotals.length ? Math.max(...dailyTotals) : 0;
    const min = nonZeroTotals.length ? Math.min(...nonZeroTotals) : 0;
    const avg = dailyTotals.length ? dailyTotals.reduce((a, b) => a + b, 0) / dailyTotals.length : 0;
    const firstDay = nonZeroTotals.length > 1 ? nonZeroTotals[0] : 0;
    const lastDay = nonZeroTotals.length > 1 ? nonZeroTotals[nonZeroTotals.length - 1] : 0;
    
    let growth = 0;
    if (nonZeroTotals.length > 1) {
      growth = ((lastDay - firstDay) / firstDay) * 100;
    }

    return {
      max: `Rp ${Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(max)}`,
      min: `Rp ${Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(min)}`,
      avg: `Rp ${Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(avg)}`,
      growth: `${growth > 0 ? '+' : ''}${growth.toFixed(1)}%`
    };
  }, [chartData]);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted text-xs mb-1 font-medium text-center">{t('kna.land_row')}</p>
          <h3 className="text-lg font-bold text-gray-800 text-center">{totalLuasTanahRow.toLocaleString('id-ID')} <span className="text-xs font-normal">m²</span></h3>
        </div>
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted text-xs mb-1 font-medium text-center">{t('kna.building_row')}</p>
          <h3 className="text-lg font-bold text-gray-800 text-center">{totalLuasBangunanRow.toLocaleString('id-ID')} <span className="text-xs font-normal">m²</span></h3>
        </div>
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted text-xs mb-1 font-medium text-center">{t('kna.land_non_row')}</p>
          <h3 className="text-lg font-bold text-gray-800 text-center">{totalLuasTanahNonRow.toLocaleString('id-ID')} <span className="text-xs font-normal">m²</span></h3>
        </div>
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted text-xs mb-1 font-medium text-center">{t('kna.building_non_row')}</p>
          <h3 className="text-lg font-bold text-gray-800 text-center">{totalLuasBangunanNonRow.toLocaleString('id-ID')} <span className="text-xs font-normal">m²</span></h3>
        </div>
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted text-xs mb-1 font-medium text-center">{t('kna.contract_row')}</p>
          <h3 className="text-xl font-bold text-gray-800 text-center">{totalKontrakRow.toLocaleString('id-ID')}</h3>
        </div>
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted text-xs mb-1 font-medium text-center">{t('kna.contract_non_row')}</p>
          <h3 className="text-xl font-bold text-gray-800 text-center">{totalKontrakNonRow.toLocaleString('id-ID')}</h3>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 className="font-semibold text-lg m-0 text-gray-800">{t('kna.contract_value')}</h3>
            <select value={chartDays} onChange={(e) => setChartDays(parseInt(e.target.value))} className="form-control" style={{ width: 'auto', padding: '4px 12px', height: 'auto' }}>
              <option value={7}>{t('dashboard.last_7_days')}</option>
              <option value={14}>{t('dashboard.last_14_days')}</option>
              <option value={30}>{t('dashboard.last_30_days')}</option>
            </select>
          </div>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="name" stroke="var(--chart-axis)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(val) => `Rp ${Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(val)}`} width={80} stroke="var(--chart-axis)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => `Rp ${value.toLocaleString('id-ID')}`} cursor={{ fill: 'var(--chart-grid)' }} contentStyle={{ backgroundColor: 'var(--chart-card)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }} itemStyle={{ color: 'var(--text-primary)', fontWeight: '500' }} />
                <Bar dataKey="ROW" name="Nilai ROW" fill="var(--chart-bar-primary)" radius={[4, 4, 0, 0]} barSize={30} />
                <Bar dataKey="NonROW" name="Nilai Non-ROW" fill="var(--chart-bar-highlight)" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', paddingTop: '20px', borderTop: '1px dashed var(--border)' }}>
            <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid var(--border)' }}>
              <p className="text-xs text-muted mb-1">{t('dashboard.highest')} ({chartDays}h)</p>
              <p className="font-semibold text-gray-800">{knaSummary.max}</p>
            </div>
            <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid var(--border)' }}>
              <p className="text-xs text-muted mb-1">{t('dashboard.lowest')} ({chartDays}h)</p>
              <p className="font-semibold text-gray-800">{knaSummary.min}</p>
            </div>
            <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid var(--border)' }}>
              <p className="text-xs text-muted mb-1">{t('dashboard.avg')} ({chartDays}h)</p>
              <p className="font-semibold text-gray-800">{knaSummary.avg}</p>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <p className="text-xs text-muted mb-1">{t('dashboard.growth')}</p>
              <p className={`font-semibold ${knaSummary.growth.startsWith('+') ? 'text-success' : knaSummary.growth === '0%' ? 'text-muted' : 'text-danger'}`}>
                {knaSummary.growth}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 className="font-semibold text-lg m-0 text-gray-800 mb-4">Pencapaian RKAD</h3>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={donutDataKNA} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                      {donutDataKNA.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={donutColors[index]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <h2 className="text-3xl font-bold" style={{ color: 'var(--brand-500)' }}>{persentaseKNA}%</h2>
                <p className="text-xs text-muted">Realisasi</p>
              </div>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ textAlign: 'center', flex: 1, borderRight: '1px solid var(--border)' }}>
                <p className="text-xs text-muted mb-1">Total Realisasi</p>
                <p className="font-semibold text-gray-800">Rp {realisasiRKAD.toLocaleString('id-ID')}</p>
              </div>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <p className="text-xs text-muted mb-1">Target RKAD</p>
                <p className="font-semibold text-gray-800">Rp {targetRKAD.toLocaleString('id-ID')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </>
  );
};

export default DashboardKNA;
