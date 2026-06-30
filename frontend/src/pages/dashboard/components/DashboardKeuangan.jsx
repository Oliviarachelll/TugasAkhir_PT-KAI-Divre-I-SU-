import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const DashboardKeuangan = ({ approvedLaporan }) => {
  const [chartDays, setChartDays] = useState(7);

  // Kalkulasi Akumulasi Keuangan
  let totalPendapatanKeuangan = 0;
  let totalPengeluaranKeuangan = 0;
  let totalLabaRugiKeuangan = 0;

  approvedLaporan.forEach(l => {
    if (l.laporan_keuangan) {
      totalPendapatanKeuangan += l.laporan_keuangan.pendapatan ? parseFloat(l.laporan_keuangan.pendapatan) : 0;
      totalPengeluaranKeuangan += l.laporan_keuangan.pengeluaran ? parseFloat(l.laporan_keuangan.pengeluaran) : 0;
      totalLabaRugiKeuangan += l.laporan_keuangan.laba_rugi ? parseFloat(l.laporan_keuangan.laba_rugi) : 0;
    }
  });

  const chartData = useMemo(() => {
    const data = [];
    const today = new Date();
    
    for (let i = chartDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const laporanHariIni = approvedLaporan.filter(l => l.tanggal.startsWith(dateStr));
      
      let p = 0;
      let e = 0;
      laporanHariIni.forEach(l => {
        if (l.laporan_keuangan) {
          p += l.laporan_keuangan.pendapatan ? parseFloat(l.laporan_keuangan.pendapatan) : 0;
          e += l.laporan_keuangan.pengeluaran ? parseFloat(l.laporan_keuangan.pengeluaran) : 0;
        }
      });
      data.push({
        name: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        Pendapatan: p,
        Pengeluaran: e
      });
    }
    return data;
  }, [approvedLaporan, chartDays]);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted text-sm mb-4 font-medium text-center">Total Pendapatan</p>
          <h3 className="text-3xl font-bold text-center" style={{ color: '#16a34a' }}>Rp {Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 2 }).format(totalPendapatanKeuangan)}</h3>
        </div>
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted text-sm mb-4 font-medium text-center">Total Pengeluaran</p>
          <h3 className="text-3xl font-bold text-center" style={{ color: '#dc2626' }}>Rp {Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 2 }).format(totalPengeluaranKeuangan)}</h3>
        </div>
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted text-sm mb-4 font-medium text-center">Total Laba/Rugi</p>
          <h3 className="text-3xl font-bold text-center" style={{ color: totalLabaRugiKeuangan >= 0 ? '#16a34a' : '#dc2626' }}>Rp {Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 2 }).format(totalLabaRugiKeuangan)}</h3>
        </div>
      </div>
      <div className="card mb-6" style={{ marginBottom: '24px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 className="font-semibold text-lg m-0 text-gray-800">Tren Arus Kas (Pendapatan & Pengeluaran)</h3>
          <select value={chartDays} onChange={(e) => setChartDays(parseInt(e.target.value))} className="form-control" style={{ width: 'auto', padding: '4px 12px', height: 'auto' }}>
            <option value={7}>7 Hari Terakhir</option>
            <option value={14}>14 Hari Terakhir</option>
            <option value={30}>30 Hari Terakhir</option>
          </select>
        </div>
        <div style={{ height: '350px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(val) => `Rp ${Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(val)}`} width={80} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip formatter={(value) => `Rp ${value.toLocaleString('id-ID')}`} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} contentStyle={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)' }} />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
              <Line type="monotone" dataKey="Pendapatan" name="Pendapatan" stroke="#16a34a" strokeWidth={3} activeDot={{ r: 6, fill: '#16a34a', stroke: '#fff', strokeWidth: 2 }} dot={{ r: 4, fill: '#16a34a', strokeWidth: 0 }} />
              <Line type="monotone" dataKey="Pengeluaran" name="Pengeluaran" stroke="#dc2626" strokeWidth={3} activeDot={{ r: 6, fill: '#dc2626', stroke: '#fff', strokeWidth: 2 }} dot={{ r: 4, fill: '#dc2626', strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
};

export default DashboardKeuangan;
