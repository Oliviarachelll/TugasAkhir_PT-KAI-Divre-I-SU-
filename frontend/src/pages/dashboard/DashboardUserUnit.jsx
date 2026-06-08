import React from 'react';
import { AlertCircle, Target, TrendingUp, CheckCircle } from 'lucide-react';
import StatCard from '../../components/ui/StatCard';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const dummyData = [
  { name: 'Kategori 1', value: 400 },
  { name: 'Kategori 2', value: 300 },
  { name: 'Kategori 3', value: 550 },
  { name: 'Kategori 4', value: 200 },
];

const DashboardUserUnit = () => {
  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Dashboard Unit</h2>
          <p className="page-subtitle">Ringkasan performa dan pelaporan unit Anda.</p>
        </div>
      </div>

      <div className="mb-6 p-4 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-3" style={{ backgroundColor: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.2)', padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', gap: '12px' }}>
        <AlertCircle className="text-warning mt-1" size={20} style={{ color: 'var(--warning)', marginTop: '2px' }} />
        <div>
          <h4 className="text-warning font-bold text-sm">Batas Waktu Pelaporan</h4>
          <p className="text-warning/80 text-sm mt-1" style={{ color: 'rgba(251,191,36,0.8)' }}>
            Laporan harian untuk hari ini harus disubmit maksimal pukul 17:00 WIB.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}>Input Laporan</button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <StatCard 
          icon={CheckCircle} color="emerald" 
          label="Status Hari Ini" value="Selesai" 
          subLabel="Laporan telah diverifikasi" 
        />
        <StatCard 
          icon={TrendingUp} color="cyan" 
          label="Total Realisasi" value="Rp 45.2M" 
          subLabel="Bulan ini" trend="up" trendValue="5%" 
        />
        <div className="card flex items-center justify-between" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px' }}>
          <div>
            <div className="stat-label">Pencapaian Target</div>
            <div className="stat-value">78%</div>
            <div className="stat-sub mt-2">Dari target tahunan</div>
          </div>
          <div className="relative w-16 h-16 flex items-center justify-center">
            {/* Simple CSS Donut Chart representation */}
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'conic-gradient(var(--brand-500) 78%, var(--bg-hover) 0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--bg-card)' }}></div>
            </div>
            <Target size={20} className="absolute text-brand-400" style={{ position: 'absolute', color: 'var(--brand-400)' }} />
          </div>
        </div>
      </div>

      <div className="card mb-4" style={{ marginBottom: '24px' }}>
        <h3 className="section-title">Realisasi per Kategori</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={dummyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              />
              <Bar dataKey="value" fill="var(--accent-emerald)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="section-title" style={{ marginBottom: 0 }}>History Laporan Terakhir</h3>
          <button className="btn btn-secondary btn-sm">Lihat Semua →</button>
        </div>
        
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Jenis Laporan</th>
                <th>Status</th>
                <th>Catatan Revisi</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Hari ini, 09:30</td>
                <td>Data Harian</td>
                <td><span className="badge badge-diajukan">MENUNGGU REVIEW</span></td>
                <td>—</td>
                <td><button className="text-brand-400 font-medium text-sm">Lihat</button></td>
              </tr>
              <tr>
                <td>Kemarin, 16:45</td>
                <td>Data Harian</td>
                <td><span className="badge badge-disetujui">TERVERIFIKASI</span></td>
                <td>—</td>
                <td><button className="text-brand-400 font-medium text-sm">Lihat</button></td>
              </tr>
              <tr>
                <td>06 Jun 2026</td>
                <td>Data Harian</td>
                <td><span className="badge badge-revisi">PERLU REVISI</span></td>
                <td className="text-danger">Data penumpang KA tidak sesuai dengan manifest</td>
                <td><button className="text-warning font-medium text-sm">Edit</button></td>
              </tr>
              <tr>
                <td>05 Jun 2026</td>
                <td>Data Harian</td>
                <td><span className="badge badge-draft">DRAFT</span></td>
                <td>—</td>
                <td><button className="text-brand-400 font-medium text-sm">Lanjutkan</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardUserUnit;
