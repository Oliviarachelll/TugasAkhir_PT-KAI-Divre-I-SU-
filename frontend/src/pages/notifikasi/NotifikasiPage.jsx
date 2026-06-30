import React from 'react';

const dummyTemplates = [
  { 
    id: 1, 
    nama: 'Pengingat Input Laporan Harian', 
    trigger: 'Setiap Hari Pukul 16:30 WIB', 
    penerima: 'Semua Unit', 
    status: 'Aktif' 
  }
];

const dummyLogs = [];

const NotifikasiPage = () => {
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="text-sm text-muted font-medium mb-1">Manajemen <span className="mx-1">&gt;</span> <span className="text-primary">Manajemen Notifikasi</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <p className="text-muted text-sm mb-1 font-medium">Total Template Aktif</p>
          <h3 className="text-3xl font-bold">1</h3>
        </div>
        <div className="card" style={{ padding: '16px 20px' }}>
          <p className="text-muted text-sm mb-1 font-medium">Notifikasi Terkirim (Hari Ini)</p>
          <h3 className="text-3xl font-bold">1</h3>
        </div>
        <div className="card" style={{ padding: '16px 20px' }}>
          <p className="text-muted text-sm mb-1 font-medium">Notifikasi Gagal</p>
          <h3 className="text-3xl font-bold">0</h3>
        </div>
        <div className="card" style={{ padding: '16px 20px' }}>
          <p className="text-muted text-sm mb-1 font-medium">Unit Belum Lapor</p>
          <h3 className="text-3xl font-bold">0</h3>
        </div>
      </div>

      <div className="card p-0 mb-6" style={{ padding: 0, marginBottom: '24px' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h3 className="font-bold text-lg m-0">Template Notifikasi</h3>
          <button className="btn btn-secondary btn-sm" style={{ backgroundColor: '#cbd5e1', color: '#1e293b', border: '1px solid #94a3b8' }}>
            + Tambah Template
          </button>
        </div>
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>NAMA TEMPLATE</th>
                <th>TRIGGER</th>
                <th>PENERIMA</th>
                <th>STATUS</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {dummyTemplates.map(t => (
                <tr key={t.id}>
                  <td>{t.nama}</td>
                  <td>{t.trigger}</td>
                  <td>{t.penerima}</td>
                  <td>{t.status}</td>
                  <td>
                    <button className="text-brand-500 hover:underline mr-1">[edit]</button>
                    {t.status === 'Aktif' ? (
                      <button className="text-brand-500 hover:underline">[nonaktif]</button>
                    ) : (
                      <button className="text-brand-500 hover:underline">[aktifkan]</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-0" style={{ padding: 0 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h3 className="font-bold text-lg m-0">Log Pengiriman Terbaru</h3>
        </div>
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>WAKTU</th>
                <th>TEMPLATE</th>
                <th>PENERIMA</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {dummyLogs.map(l => (
                <tr key={l.id}>
                  <td>{l.waktu}</td>
                  <td>{l.template}</td>
                  <td>{l.penerima}</td>
                  <td>{l.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default NotifikasiPage;
