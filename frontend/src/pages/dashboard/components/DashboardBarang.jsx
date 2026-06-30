import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const DashboardBarang = ({ approvedLaporan }) => {
  const [chartDays, setChartDays] = useState(7);

  // Kalkulasi Akumulasi Barang
  let totalVolumeBarang = 0;
  let totalPendapatanBarang = 0;
  let totalJmlKA = 0;
  let totalVolumeProgram = 0;
  let totalPendapatanProgram = 0;

  approvedLaporan.forEach(l => {
    if (l.laporan_barang && Array.isArray(l.laporan_barang)) {
      l.laporan_barang.forEach(b => {
        totalVolumeBarang += b.volume ? parseFloat(b.volume) : 0;
        totalPendapatanBarang += b.pendapatan ? parseFloat(b.pendapatan) : 0;
        totalJmlKA += b.jml_ka ? parseInt(b.jml_ka) : 0;
        totalVolumeProgram += b.volume_program ? parseFloat(b.volume_program) : 0;
        totalPendapatanProgram += b.pendapatan_program ? parseFloat(b.pendapatan_program) : 0;
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
      
      let vol = 0;
      let pend = 0;
      laporanHariIni.forEach(l => {
        if (l.laporan_barang) {
          l.laporan_barang.forEach(b => {
            vol += b.volume ? parseFloat(b.volume) : 0;
            pend += b.pendapatan ? parseFloat(b.pendapatan) : 0;
          });
        }
      });
      data.push({
        name: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        Volume: vol,
        Pendapatan: pend
      });
    }
    return data;
  }, [approvedLaporan, chartDays]);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted text-sm mb-4 font-medium text-center">Total Perjalanan KA</p>
          <h3 className="text-4xl font-bold text-gray-800 text-center">{totalJmlKA.toLocaleString('id-ID')}</h3>
        </div>
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted text-sm mb-4 font-medium text-center">Total Volume (Realisasi / Target)</p>
          <h3 className="text-3xl font-bold text-gray-800 text-center mb-2">{totalVolumeBarang.toLocaleString('id-ID')} <span className="text-sm font-normal text-muted">/ {totalVolumeProgram.toLocaleString('id-ID')} Ton</span></h3>
          <div style={{ padding: '4px 12px', backgroundColor: 'var(--brand-500)', color: '#fff', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold' }}>
            {totalVolumeProgram > 0 ? ((totalVolumeBarang / totalVolumeProgram) * 100).toFixed(1) : 0}%
          </div>
        </div>
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted text-sm mb-4 font-medium text-center">Total Pendapatan (Realisasi / Target)</p>
          <h3 className="text-3xl font-bold text-gray-800 text-center mb-2">Rp {Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 2 }).format(totalPendapatanBarang)}</h3>
          <p className="text-xs text-gray-500 mb-2">Target: Rp {Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 2 }).format(totalPendapatanProgram)}</p>
          <div style={{ padding: '4px 12px', backgroundColor: 'var(--brand-500)', color: '#fff', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold' }}>
            {totalPendapatanProgram > 0 ? ((totalPendapatanBarang / totalPendapatanProgram) * 100).toFixed(1) : 0}%
          </div>
        </div>
      </div>
      <div className="card mb-6" style={{ marginBottom: '24px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 className="font-semibold text-lg m-0 text-gray-800">Tren Volume & Pendapatan Barang</h3>
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
              <YAxis yAxisId="left" tickFormatter={(val) => `${Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(val)} Ton`} width={80} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => `Rp ${Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(val)}`} width={100} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip formatter={(value, name) => [name.includes('Pendapatan') ? `Rp ${value.toLocaleString('id-ID')}` : `${value.toLocaleString('id-ID')} Ton`, name]} cursor={{ fill: 'var(--bg-main)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)' }} />
              <Bar yAxisId="left" dataKey="Volume" name="Volume (Ton)" fill="var(--brand-500)" radius={[4, 4, 0, 0]} barSize={30} />
              <Bar yAxisId="right" dataKey="Pendapatan" name="Pendapatan (Rp)" fill="var(--success)" radius={[4, 4, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
};

export default DashboardBarang;
