import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer
} from 'recharts';

const dummyCPUData = Array.from({ length: 20 }, (_, i) => ({
  time: `1${i % 10}:00`,
  cpu: Math.floor(Math.random() * 40) + 20,
}));

const MonitoringPage = () => {
  return (
    <div className="flex flex-col gap-6" style={{ padding: '0' }}>
      
      {/* Tombol Refresh (di atas kanan) */}
      <div className="flex justify-between items-center mb-2">
        <div className="text-gray-600 text-sm">Pantau kesehatan server, database, dan service backend.</div>
        <button className="px-4 py-2 border border-gray-400 bg-white text-gray-800 text-sm font-medium hover:bg-gray-50">
          Refresh Data
        </button>
      </div>

      {/* Grid Cards 4 Kolom */}
      <div className="grid grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="card" style={{ padding: '16px', borderRadius: '4px', display: 'flex', flexDirection: 'column' }}>
          <div className="text-sm font-bold text-gray-800 mb-6">Backend API</div>
          <div className="text-3xl font-bold text-gray-900 mb-2">Online</div>
          <div className="flex justify-between text-xs text-gray-500 mt-auto">
            <span>Uptime: 99.9%</span>
            <span>120ms</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="card" style={{ padding: '16px', borderRadius: '4px', display: 'flex', flexDirection: 'column' }}>
          <div className="text-sm font-bold text-gray-800 mb-6">MySQL Database</div>
          <div className="text-3xl font-bold text-gray-900 mb-2">Online</div>
          <div className="flex justify-between text-xs text-gray-500 mt-auto">
            <span>Koneksi aktif: 4</span>
            <span>15ms</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="card" style={{ padding: '16px', borderRadius: '4px', display: 'flex', flexDirection: 'column' }}>
          <div className="text-sm font-bold text-gray-800 mb-6">WhatsApp Service</div>
          <div className="text-3xl font-bold text-gray-900 mb-2">Connected</div>
          <div className="flex justify-between text-xs text-gray-500 mt-auto">
            <span>Sesi aktif</span>
            <span>Ping: 45ms</span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="card" style={{ padding: '16px', borderRadius: '4px', display: 'flex', flexDirection: 'column' }}>
          <div className="text-sm font-bold text-gray-800 mb-6">Socket.io Server</div>
          <div className="text-3xl font-bold text-gray-900 mb-2">Online</div>
          <div className="flex justify-between text-xs text-gray-500 mt-auto">
            <span>Client terhubung: 12</span>
            <span>Ping: 20ms</span>
          </div>
        </div>
      </div>

      {/* 2 Kolom Bawah: Chart & Log */}
      <div className="grid grid-cols-2 gap-4">
        
        {/* Kiri: Grafik */}
        <div className="card" style={{ padding: '16px', borderRadius: '4px' }}>
          <h3 className="text-base font-bold text-gray-900 mb-6">CPU & RAM Usage</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={dummyCPUData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                <Line type="monotone" dataKey="cpu" stroke="#111827" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
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
