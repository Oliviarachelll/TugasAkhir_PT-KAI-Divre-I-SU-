import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const DashboardPenumpang = ({ approvedLaporan }) => {
  const [chartDays, setChartDays] = useState(7);

  // Kalkulasi Akumulasi Penumpang
  let totalJmlPenumpang = 0;
  let totalPendapatanPenumpang = 0;

  approvedLaporan.forEach(l => {
    if (l.laporan_penumpang && Array.isArray(l.laporan_penumpang)) {
      l.laporan_penumpang.forEach(p => {
        totalJmlPenumpang += p.jml_penumpang ? parseInt(p.jml_penumpang) : 0;
        totalPendapatanPenumpang += p.pendapatan ? parseFloat(p.pendapatan) : 0;
      });
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
      
      let pen = 0;
      let pend = 0;
      laporanHariIni.forEach(l => {
        if (l.laporan_penumpang) {
          l.laporan_penumpang.forEach(p => {
            pen += p.jml_penumpang ? parseInt(p.jml_penumpang) : 0;
            pend += p.pendapatan ? parseFloat(p.pendapatan) : 0;
          });
        }
      });
      data.push({
        name: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        Penumpang: pen,
        Pendapatan: pend
      });
    }
    return data;
  }, [approvedLaporan, chartDays]);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted text-sm mb-4 font-medium text-center">Total Penumpang</p>
          <h3 className="text-4xl font-bold text-gray-800 text-center">{totalJmlPenumpang.toLocaleString('id-ID')} <span className="text-xl font-normal">Orang</span></h3>
        </div>
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted text-sm mb-4 font-medium text-center">Total Pendapatan Penumpang</p>
          <h3 className="text-4xl font-bold text-gray-800 text-center">Rp {totalPendapatanPenumpang.toLocaleString('id-ID')}</h3>
        </div>
      </div>
      <div className="card mb-6" style={{ marginBottom: '24px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 className="font-semibold text-lg m-0 text-gray-800">Tren Penumpang & Pendapatan</h3>
          <select value={chartDays} onChange={(e) => setChartDays(parseInt(e.target.value))} className="form-control" style={{ width: 'auto', padding: '4px 12px', height: 'auto' }}>
            <option value={7}>7 Hari Terakhir</option>
            <option value={14}>14 Hari Terakhir</option>
            <option value={30}>30 Hari Terakhir</option>
          </select>
        </div>
        <div style={{ width: '100%', height: 250 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" tickFormatter={(val) => Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(val)} width={60} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => `Rp ${Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(val)}`} width={100} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip formatter={(value, name) => [name.includes('Pendapatan') ? `Rp ${value.toLocaleString('id-ID')}` : value.toLocaleString('id-ID'), name]} cursor={{ fill: 'var(--bg-main)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)' }} />
              <Bar yAxisId="left" dataKey="Penumpang" name="Jml Penumpang" fill="var(--brand-500)" radius={[4, 4, 0, 0]} barSize={30} />
              <Bar yAxisId="right" dataKey="Pendapatan" name="Pendapatan (Rp)" fill="var(--warning)" radius={[4, 4, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
};

export default DashboardPenumpang;
