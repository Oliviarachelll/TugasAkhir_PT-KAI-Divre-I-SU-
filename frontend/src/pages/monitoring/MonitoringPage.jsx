import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';
import systemApi from '../../api/system.api';
import toast from 'react-hot-toast';

const MonitoringPage = () => {
  const [metricsData, setMetricsData] = useState([]);
  const [currentMetrics, setCurrentMetrics] = useState({ cpu: 0, ram: 0 });
  const [isBackendOnline, setIsBackendOnline] = useState(true);

  const fetchMetrics = async () => {
    try {
      const res = await systemApi.getSystemStats();
      if (res.status === 'success') {
        setIsBackendOnline(true);
        const { cpu, ram } = res.data;
        setCurrentMetrics({ cpu, ram });
        
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

        setMetricsData(prev => {
          const newData = [...prev, { time: timeString, cpu, ram }];
          // Keep last 20 data points
          if (newData.length > 20) return newData.slice(newData.length - 20);
          return newData;
        });
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      setIsBackendOnline(false);
    }
  };

  useEffect(() => {
    // Fetch immediately on mount
    fetchMetrics();
    // Poll every 5 seconds
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    fetchMetrics();
    toast.success('Data diperbarui');
  };

  return (
    <div className="flex flex-col gap-6" style={{ padding: '0' }}>
      
      {/* Tombol Refresh (di atas kanan) */}
      <div className="flex justify-between items-center mb-2">
        <div className="text-gray-600 text-sm">Pantau beban kerja CPU & RAM server secara real-time.</div>
        <button onClick={handleRefresh} className="px-4 py-2 border border-gray-400 bg-white text-gray-800 text-sm font-medium hover:bg-gray-50">
          Refresh Data
        </button>
      </div>

      {/* Grid Cards 4 Kolom */}
      <div className="grid grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="card" style={{ padding: '16px', borderRadius: '4px', display: 'flex', flexDirection: 'column' }}>
          <div className="text-sm font-bold text-gray-800 mb-6">Backend API</div>
          <div className={`text-3xl font-bold mb-2 ${isBackendOnline ? 'text-green-600' : 'text-red-600'}`}>
            {isBackendOnline ? 'Online' : 'Offline'}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-auto">
            <span>Server Node.js</span>
            <span>Real-time</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="card" style={{ padding: '16px', borderRadius: '4px', display: 'flex', flexDirection: 'column' }}>
          <div className="text-sm font-bold text-gray-800 mb-6">CPU Load</div>
          <div className="text-3xl font-bold text-gray-900 mb-2">{currentMetrics.cpu}%</div>
          <div className="flex justify-between text-xs text-gray-500 mt-auto">
            <span>Beban Prosesor</span>
            <span>OS Metrics</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="card" style={{ padding: '16px', borderRadius: '4px', display: 'flex', flexDirection: 'column' }}>
          <div className="text-sm font-bold text-gray-800 mb-6">RAM Usage</div>
          <div className="text-3xl font-bold text-gray-900 mb-2">{currentMetrics.ram}%</div>
          <div className="flex justify-between text-xs text-gray-500 mt-auto">
            <span>Kapasitas Terpakai</span>
            <span>OS Metrics</span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="card" style={{ padding: '16px', borderRadius: '4px', display: 'flex', flexDirection: 'column' }}>
          <div className="text-sm font-bold text-gray-800 mb-6">Polling Interval</div>
          <div className="text-3xl font-bold text-gray-900 mb-2">5 Detik</div>
          <div className="flex justify-between text-xs text-gray-500 mt-auto">
            <span>Auto Refresh</span>
            <span>Aktif</span>
          </div>
        </div>
      </div>

      {/* 2 Kolom Bawah: Chart & Log */}
      <div className="grid grid-cols-2 gap-4">
        
        {/* Kiri: Grafik */}
        <div className="card" style={{ padding: '16px', borderRadius: '4px' }}>
          <h3 className="text-base font-bold text-gray-900 mb-6">Real-time CPU & RAM Usage (%)</h3>
          <div style={{ width: '100%', height: 300 }}>
            {metricsData.length > 0 ? (
              <ResponsiveContainer>
                <LineChart data={metricsData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" name="CPU (%)" dataKey="cpu" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" name="RAM (%)" dataKey="ram" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">Menunggu metrik server...</div>
            )}
          </div>
        </div>

        {/* Kanan: Logs */}
        <div className="card" style={{ padding: '16px', borderRadius: '4px' }}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-bold text-gray-900">System Logs Terakhir</h3>
            <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 border border-gray-200">24 Jam Terakhir</span>
          </div>
          
          <div className="flex flex-col gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-4 text-sm">
                <div className="text-gray-500 w-20 flex-shrink-0">10:{i}5:22</div>
                <div className="font-bold text-gray-700 w-16 flex-shrink-0">
                  {i === 3 ? '[WARN]' : '[INFO]'}
                </div>
                <div className="text-gray-800">
                  {i === 3 ? 'Koneksi ke database lambat (>500ms).' : 'Berhasil sinkronisasi data dari client.'}
                </div>
              </div>
            ))}
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default MonitoringPage;
