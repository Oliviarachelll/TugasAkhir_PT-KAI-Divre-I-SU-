import React, { useState, useEffect } from 'react';
import usePermintaanStore from '../../store/permintaan.store';
import apiClient from '../../api/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const StatCard = ({ title, value, subLabel }) => {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '16px', borderRadius: '4px' }}>
      <span className="text-sm font-medium text-gray-500 mb-2">{title}</span>
      <span className="text-4xl font-bold text-gray-900 mb-4">{value}</span>
      <div>
        <span className="text-xs text-gray-600 px-2 py-1 rounded-full border border-gray-400">
          {subLabel}
        </span>
      </div>
    </div>
  );
};

const DashboardIT = () => {
  const { permintaanList, fetchPermintaan, isLoading } = usePermintaanStore();
  const [statsHistory, setStatsHistory] = useState([]);

  useEffect(() => {
    fetchPermintaan();
    
    // Fetch system stats every 5 seconds
    const fetchStats = async () => {
      try {
        const response = await apiClient.get('/system/stats');
        // apiClient interceptor returns response.data natively
        // So response is { success: true, data: { ram, cpu } }
        const statsData = response.data;
        
        if (!statsData) return;

        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        
        const currentCpu = statsData.cpu;
        const currentRam = statsData.ram;

        setStatsHistory(prev => {
          const newStats = [...prev, { time: timeStr, cpu: currentCpu, ram: currentRam }];
          // Keep only last 20 data points
          if (newStats.length > 20) return newStats.slice(newStats.length - 20);
          return newStats;
        });
      } catch (error) {
        console.error('Failed to fetch system stats:', error);
      }
    };
    
    fetchStats(); // Initial fetch
    const intervalId = setInterval(fetchStats, 5000);
    
    return () => clearInterval(intervalId);
  }, [fetchPermintaan]);

  const totalTiket = permintaanList.length;
  const tiketOpen = permintaanList.filter(t => t.status === 'OPEN').length;
  const tiketSelesai = permintaanList.filter(t => t.status === 'RESOLVED' || t.status === 'SELESAI' || t.status === 'CLOSED').length;

  const getRecentTickets = () => {
    return [...permintaanList]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);
  };

  const timeAgo = (dateStr) => {
    const diffMs = new Date() - new Date(dateStr);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit yang lalu`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs} jam yang lalu`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays} hari yang lalu`;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-3 py-1 text-xs border border-gray-500 rounded-full text-gray-600 bg-gray-50">OPEN</span>;
      case 'IN_PROGRESS':
        return <span className="px-3 py-1 text-xs border border-blue-500 rounded-full text-blue-600 bg-blue-50">PROSES</span>;
      case 'RESOLVED':
      case 'SELESAI':
      case 'CLOSED':
        return <span className="px-3 py-1 text-xs border border-green-500 rounded-full text-green-600 bg-green-50">SELESAI</span>;
      default:
        return <span className="px-3 py-1 text-xs border border-gray-500 rounded-full text-gray-600 bg-gray-50">{status}</span>;
    }
  };

  return (
    <div className="flex flex-col gap-6" style={{ padding: '0' }}>
      {/* Grid Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Total Tiket" value={isLoading ? '...' : totalTiket} subLabel="Keseluruhan" />
        <StatCard title="Tiket Open" value={isLoading ? '...' : tiketOpen} subLabel="Perlu penanganan" />
        <StatCard title="Tiket Selesai" value={isLoading ? '...' : tiketSelesai} subLabel="Terselesaikan" />
        <StatCard title="Insiden Sistem" value="0" subLabel="Sistem berjalan normal" />
      </div>

      {/* System Stats Chart */}
      <div className="card" style={{ padding: '16px', borderRadius: '4px' }}>
        <h3 className="text-lg font-bold text-gray-900 mb-4">CPU & RAM Usage</h3>
        <div style={{ height: '300px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={statsHistory} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="time" stroke="var(--chart-axis)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis 
                type="number"
                stroke="var(--chart-axis)" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                domain={[0, 100]} 
                ticks={[0, 25, 50, 75, 100]} 
              />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--chart-card)', boxShadow: 'var(--shadow-sm)' }}
                itemStyle={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}
                animationDuration={100}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '14px', paddingTop: '10px', color: 'var(--text-secondary)' }} />
              <Line 
                type="monotone" 
                dataKey="cpu" 
                name="CPU (%)" 
                stroke="var(--chart-line-blue)" 
                strokeWidth={2} 
                dot={false} 
                activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--chart-line-blue)' }} 
                isAnimationActive={false}
                style={{ filter: 'drop-shadow(0 0 3px rgba(85, 178, 255, 0.4))' }}
              />
              <Line 
                type="monotone" 
                dataKey="ram" 
                name="RAM (%)" 
                stroke="var(--chart-line-orange)" 
                strokeWidth={2} 
                dot={false} 
                activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--chart-line-orange)' }} 
                isAnimationActive={false}
                style={{ filter: 'drop-shadow(0 0 3px rgba(255, 152, 58, 0.4))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: '0', borderRadius: '4px', overflow: 'hidden' }}>
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Tiket Terbaru</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-100 text-gray-600 font-medium">
              <tr>
                <th className="px-4 py-3">ID TIKET</th>
                <th className="px-4 py-3">NAMA USER</th>
                <th className="px-4 py-3">UNIT</th>
                <th className="px-4 py-3">JENIS</th>
                <th className="px-4 py-3">WAKTU</th>
                <th className="px-4 py-3">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">Memuat data tiket...</td>
                </tr>
              ) : getRecentTickets().length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">Belum ada tiket baru.</td>
                </tr>
              ) : (
                getRecentTickets().map((t, i) => (
                  <tr key={t.id_permintaan || i}>
                    <td className="px-4 py-3">TKT-{String(t.id_permintaan).padStart(3, '0')}</td>
                    <td className="px-4 py-3">{t.pengaju?.nama || '-'}</td>
                    <td className="px-4 py-3">{t.pengaju?.unit?.nama_unit || '-'}</td>
                    <td className="px-4 py-3">{t.jenis?.replace(/_/g, ' ') || '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{timeAgo(t.created_at)}</td>
                    <td className="px-4 py-3">
                      {getStatusBadge(t.status)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Status */}
      <div className="card" style={{ padding: '0', borderRadius: '4px' }}>
        <div className="p-4">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Status Sistem</h3>
          <div className="flex gap-8">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="font-medium text-gray-800">Database Utama</span>
              <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200">Online</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="font-medium text-gray-800">WhatsApp Gateway</span>
              <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200">Online</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="font-medium text-gray-800">Socket Realtime</span>
              <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200">Online</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default DashboardIT;
