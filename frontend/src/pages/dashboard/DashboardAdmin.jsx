import React from 'react';
import { FileText, CheckCircle, Clock, AlertTriangle, Download } from 'lucide-react';
import StatCard from '../../components/ui/StatCard';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';

const dummyBarData = [
  { name: 'Unit A', value: 400 },
  { name: 'Unit B', value: 300 },
  { name: 'Unit C', value: 550 },
  { name: 'Unit D', value: 200 },
];

const dummyLineData = [
  { name: 'Jan', value: 65 },
  { name: 'Feb', value: 59 },
  { name: 'Mar', value: 80 },
  { name: 'Apr', value: 81 },
  { name: 'May', value: 56 },
  { name: 'Jun', value: 90 },
];

const DashboardAdmin = () => {
  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Dashboard Admin Global</h2>
          <p className="page-subtitle">Ringkasan laporan dari seluruh unit operasional.</p>
        </div>
        <div className="flex gap-3">
          <select className="form-control" style={{ width: 'auto' }}>
            <option>Semua Unit</option>
            <option>Unit Pusat</option>
            <option>DAOP 1</option>
            <option>DAOP 2</option>
          </select>
          <button className="btn btn-secondary">
            <Download size={18} /> Export PDF
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard 
          icon={FileText} color="brand" 
          label="Total Laporan" value="1,284" 
          subLabel="Bulan ini" trend="up" trendValue="12%" 
        />
        <StatCard 
          icon={Clock} color="amber" 
          label="Menunggu Review" value="45" 
          subLabel="Perlu tindakan" 
        />
        <StatCard 
          icon={CheckCircle} color="emerald" 
          label="Laporan Disetujui" value="1,120" 
          subLabel="Bulan ini" trend="up" trendValue="8%" 
        />
        <StatCard 
          icon={AlertTriangle} color="rose" 
          label="Perlu Revisi" value="12" 
          subLabel="Dalam proses" trend="down" trendValue="2%" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="card">
          <h3 className="section-title">Volume Laporan per Unit</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={dummyBarData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Bar dataKey="value" fill="var(--brand-500)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">Tren Laporan (6 Bulan)</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={dummyLineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                />
                <Line type="monotone" dataKey="value" stroke="var(--accent-cyan)" strokeWidth={3} dot={{ r: 4, fill: 'var(--bg-card)', strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="section-title" style={{ marginBottom: 0 }}>Laporan Terbaru Menunggu Review</h3>
          <button className="btn btn-secondary btn-sm">Lihat Semua →</button>
        </div>
        
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID Laporan</th>
                <th>Nama Unit</th>
                <th>Waktu Lapor</th>
                <th>Jenis</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((i) => (
                <tr key={i}>
                  <td className="font-medium text-primary">LPR-2606-{i.toString().padStart(3, '0')}</td>
                  <td>Unit DAOP {i}</td>
                  <td>Hari ini, 09:{i}0 WIB</td>
                  <td>Data Harian</td>
                  <td>
                    <span className="badge badge-diajukan">MENUNGGU REVIEW</span>
                  </td>
                  <td>
                    <button className="text-brand-400 hover:text-brand-300 font-medium text-sm">Review</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardAdmin;
