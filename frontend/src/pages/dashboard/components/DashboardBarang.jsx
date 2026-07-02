import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { useTranslation } from 'react-i18next';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#14b8a6', '#6366f1', '#ec4899'];

const DashboardBarang = ({ approvedLaporan }) => {
  const [chartDays, setChartDays] = useState(7);
  const { t } = useTranslation();

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
            // Include all (which means skipping 99 to avoid double count? Actually wait! totalItem (99) already sums it up)
            // If we sum everything including 99, it doubles. So let's only sum where id_komoditi !== 99
            if (b.id_komoditi !== 99) {
              vol += b.volume ? parseFloat(b.volume) : 0;
              pend += b.pendapatan ? parseFloat(b.pendapatan) : 0;
            }
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

  const commodityData = useMemo(() => {
    const commMap = {};
    
    approvedLaporan.forEach(l => {
      if (l.laporan_barang && Array.isArray(l.laporan_barang)) {
        l.laporan_barang.forEach(b => {
          if (b.id_komoditi === 99) return;
          
          const name = b.komoditi?.nama_komoditi || b.nama_kustom || 'Lainnya';
          if (!commMap[name]) {
            commMap[name] = { name, Volume: 0, Pendapatan: 0 };
          }
          commMap[name].Volume += b.volume ? parseFloat(b.volume) : 0;
          commMap[name].Pendapatan += b.pendapatan ? parseFloat(b.pendapatan) : 0;
        });
      }
    });

    return Object.values(commMap).sort((a, b) => b.Volume - a.Volume);
  }, [approvedLaporan]);

  const latestCommodityData = useMemo(() => {
    const sorted = [...approvedLaporan].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
    const latest = sorted[0];
    if (!latest || !latest.laporan_barang) return [];
    
    return latest.laporan_barang
      .filter(b => b.id_komoditi !== 99)
      .map(b => {
        const name = b.komoditi?.nama_komoditi || b.nama_kustom || 'Lainnya';
        return {
          name,
          RealisasiVol: b.volume_kumulatif ? parseFloat(b.volume_kumulatif) : 0,
          TargetVol: b.volume_program ? parseFloat(b.volume_program) : 0,
          RealisasiPdt: b.pendapatan_kumulatif ? parseFloat(b.pendapatan_kumulatif) : 0,
          TargetPdt: b.pendapatan_program ? parseFloat(b.pendapatan_program) : 0,
        };
      })
      .sort((a, b) => b.RealisasiVol - a.RealisasiVol);
  }, [approvedLaporan]);

  // Total accumulation for volume and pendapatan pie charts
  const totalCommVolume = commodityData.reduce((acc, curr) => acc + curr.Volume, 0);
  const totalCommPendapatan = commodityData.reduce((acc, curr) => acc + curr.Pendapatan, 0);

  return (
    <>
      {/* 3 Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted text-sm mb-4 font-medium text-center">{t('barang.total_volume')}</p>
          <h3 className="text-3xl font-bold text-gray-800 text-center">{Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(totalVolumeBarang)}</h3>
        </div>
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted text-sm mb-4 font-medium text-center">{t('barang.total_income')}</p>
          <h3 className="text-3xl font-bold text-gray-800 text-center" style={{ color: '#16a34a' }}>Rp {Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 2 }).format(totalPendapatanBarang)}</h3>
        </div>
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted text-sm mb-4 font-medium text-center">{t('barang.total_trips')}</p>
          <h3 className="text-3xl font-bold text-gray-800 text-center">{totalJmlKA.toLocaleString('id-ID')}</h3>
        </div>
      </div>

      {/* Rincian Komoditi Pie Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }} className="md:grid-cols-1 lg:grid-cols-2">
        
        {/* Distribusi Volume */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 className="font-semibold text-lg m-0 text-gray-800 mb-4">{t('barang.composition')}</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={commodityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="Volume"
                  stroke="none"
                >
                  {commodityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => [`${value.toLocaleString('id-ID')} Ton (${((value / totalCommVolume) * 100).toFixed(1)}%)`, 'Volume']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribusi Pendapatan */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 className="font-semibold text-sm m-0 mb-4 text-slate-700">Distribusi Pendapatan Harian per Komoditi</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={commodityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="Pendapatan"
                  stroke="none"
                >
                  {commodityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => [`Rp ${value.toLocaleString('id-ID')} (${((value / totalCommPendapatan) * 100).toFixed(1)}%)`, 'Pendapatan']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Target vs Kumulatif (Latest Report Kumulatif) */}
      <div className="card mb-6" style={{ padding: '20px' }}>
        <h3 className="font-semibold text-lg m-0 mb-6 text-gray-800">Kumulatif vs Program per Komoditi (Tahun Ini)</h3>
        <div style={{ width: '100%', height: 350 }}>
          <ResponsiveContainer>
            <BarChart data={latestCommodityData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              
              <YAxis yAxisId="left" tickFormatter={(val) => `${Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(val)} Ton`} width={80} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              
              <Tooltip 
                formatter={(value, name) => [`${value.toLocaleString('id-ID')} Ton`, name]} 
                cursor={{ fill: 'var(--bg-main)' }} 
                contentStyle={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)' }} 
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              
              <Bar yAxisId="left" dataKey="RealisasiVol" name="Kumulatif Volume (Ton)" fill="var(--brand-500)" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar yAxisId="left" dataKey="TargetVol" name="Program Volume (Ton)" fill="var(--text-muted)" opacity={0.3} radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tren Harian */}
      <div className="card mb-6" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 className="font-semibold text-lg m-0 text-gray-800">{t('barang.trend')}</h3>
          <select value={chartDays} onChange={(e) => setChartDays(parseInt(e.target.value))} className="form-control" style={{ width: 'auto', padding: '4px 12px', height: 'auto' }}>
            <option value={7}>{t('dashboard.last_7_days')}</option>
            <option value={14}>{t('dashboard.last_14_days')}</option>
            <option value={30}>{t('dashboard.last_30_days')}</option>
          </select>
        </div>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" tickFormatter={(val) => `${Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(val)} Ton`} width={80} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => `Rp ${Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(val)}`} width={100} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip formatter={(value, name) => [name.includes('Pendapatan') ? `Rp ${value.toLocaleString('id-ID')}` : `${value.toLocaleString('id-ID')} Ton`, name]} cursor={{ fill: 'var(--bg-main)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)' }} />
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              <Bar yAxisId="left" dataKey="Volume" name="Volume Total (Ton)" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={25} />
              <Bar yAxisId="right" dataKey="Pendapatan" name="Pendapatan Total (Rp)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={25} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
};

export default DashboardBarang;
