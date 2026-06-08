import React from 'react';

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
  return (
    <div className="flex flex-col gap-6" style={{ padding: '0' }}>
      {/* Grid Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Total Tiket" value="124" subLabel="Bulan ini" />
        <StatCard title="Tiket Open" value="12" subLabel="Perlu penanganan" />
        <StatCard title="Tiket Selesai" value="112" subLabel="Terselesaikan" />
        <StatCard title="Insiden Sistem" value="0" subLabel="Sistem berjalan normal" />
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
              <tr>
                <td className="px-4 py-3">TKT-001</td>
                <td className="px-4 py-3">Nama User 1</td>
                <td className="px-4 py-3">Nama Unit</td>
                <td className="px-4 py-3">Lupa Password</td>
                <td className="px-4 py-3">10 menit yang lalu</td>
                <td className="px-4 py-3">
                  <span className="px-3 py-1 text-xs border border-gray-500 rounded-full text-gray-600 bg-gray-50">OPEN</span>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">TKT-002</td>
                <td className="px-4 py-3">Nama User 2</td>
                <td className="px-4 py-3">Nama Unit</td>
                <td className="px-4 py-3">Buka Kunci</td>
                <td className="px-4 py-3">30 menit yang lalu</td>
                <td className="px-4 py-3">
                  <span className="px-3 py-1 text-xs border border-gray-500 rounded-full text-gray-600 bg-gray-50">OPEN</span>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">TKT-003</td>
                <td className="px-4 py-3">Nama User 3</td>
                <td className="px-4 py-3">Nama Unit</td>
                <td className="px-4 py-3">Kendala Jaringan</td>
                <td className="px-4 py-3">1 jam yang lalu</td>
                <td className="px-4 py-3">
                  <span className="px-3 py-1 text-xs border border-gray-500 rounded-full text-gray-600 bg-gray-50">OPEN</span>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">TKT-004</td>
                <td className="px-4 py-3">Nama User 4</td>
                <td className="px-4 py-3">Nama Unit</td>
                <td className="px-4 py-3">Akses Aplikasi</td>
                <td className="px-4 py-3">1 hari yang lalu</td>
                <td className="px-4 py-3">
                  <span className="px-3 py-1 text-xs border border-gray-500 rounded-full text-gray-600 bg-gray-50">RESOLVED</span>
                </td>
              </tr>
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
              <div className="w-3 h-3 rounded-full bg-gray-400"></div>
              <span className="font-medium text-gray-800">Database Utama</span>
              <span className="text-xs text-gray-500">status</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400"></div>
              <span className="font-medium text-gray-800">WhatsApp Gateway</span>
              <span className="text-xs text-gray-500">status</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400"></div>
              <span className="font-medium text-gray-800">Socket Realtime</span>
              <span className="text-xs text-gray-500">status</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default DashboardIT;
