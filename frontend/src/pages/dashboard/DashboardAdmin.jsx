import React, { useEffect } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useNavigate } from 'react-router-dom';
import { FileText, CheckCircle, Clock, AlertTriangle, Download } from 'lucide-react';
import StatCard from '../../components/ui/StatCard';
import useLaporanStore from '../../store/laporan.store';
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
  const navigate = useNavigate();
  const { laporanList, fetchLaporan, isLoading } = useLaporanStore();

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text('Laporan Dashboard Admin KAI', 14, 15);
    doc.autoTable({
      head: [['Metric', 'Value']],
      body: [
        ['Total Laporan', '1,284'],
        ['Menunggu Review', '45'],
        ['Kinerja Rata-rata', '94%']
      ],
      startY: 20
    });
    doc.save('Dashboard_Admin_KAI.pdf');
  };

  useEffect(() => {
    // Ambil data laporan
    fetchLaporan({ limit: 10 });
  }, [fetchLaporan]);

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="page-subtitle">Ringkasan laporan dari seluruh unit operasional.</p>
        </div>
        <div className="flex gap-3">
          <select className="form-control" style={{ width: 'auto' }}>
            <option>Semua Unit</option>
            <option>Unit Pusat</option>
            <option>DAOP 1</option>
            <option>DAOP 2</option>
          </select>
          <button className="btn btn-secondary" onClick={handleExportPDF}>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: '#F9FAFB' }}
                  contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#F3F4F6', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
                  itemStyle={{ color: '#111827', fontWeight: '500' }}
                />
                <Bar dataKey="value" fill="var(--brand-500)" radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: '24px', color: '#64748b', fontSize: '12px' }}>
            <span>AVERAGE: —</span>
            <span>PEAK: —</span>
            <span>GROWTH: —</span>
          </div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <h3 className="font-bold text-lg mb-4">Judul Grafik Trend</h3>
          <div style={{ width: '100%', height: 200, marginBottom: '16px' }}>
            <ResponsiveContainer>
              <LineChart data={dummyLineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#F3F4F6', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
                />
                <Line type="monotone" dataKey="a" stroke="var(--brand-500)" strokeWidth={2} dot={{ r: 4, fill: 'var(--brand-500)' }} />
                <Line type="monotone" dataKey="b" stroke="#D1D5DB" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: '24px', color: '#6B7280', fontSize: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '3px', backgroundColor: 'var(--brand-500)', borderRadius: '2px' }}></div> Label A</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '3px', backgroundColor: '#D1D5DB', borderRadius: '2px' }}></div> Label B</span>
          </div>
        </div>
      </div>

      <div className="card p-0" style={{ padding: 0 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h3 className="font-bold text-lg m-0">Judul Tabel <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#64748b' }}>Lihat Semua →</span></h3>
        </div>
        
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>ID UNIT</th>
                <th>NAMA UNIT</th>
                <th>WAKTU LAPOR</th>
                <th>JENIS</th>
                <th>STATUS</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="text-center text-muted p-4">Memuat data...</td>
                </tr>
              ) : laporanList.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center text-muted p-4">Tidak ada data laporan.</td>
                </tr>
              ) : laporanList.map((item) => (
                <tr key={item.id_laporan}>
                  <td className="font-medium text-primary">LPR-{item.id_laporan}</td>
                  <td>{item.unit?.nama_unit || `Unit ID: ${item.id_unit}`}</td>
                  <td>{new Date(item.tanggal).toLocaleDateString('id-ID')}</td>
                  <td>Data Harian</td>
                  <td>
                    <span className={`badge ${item.status === 'DISETUJUI' ? 'badge-disetujui' : item.status === 'DITOLAK' || item.status === 'REVISI' ? 'badge-revisi' : 'badge-diajukan'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate(`/laporan/review/${item.id_laporan}`)}
                    >
                      Review
                    </button>
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
