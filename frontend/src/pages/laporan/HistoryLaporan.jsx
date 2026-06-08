import React from 'react';
import { Download, Filter, Eye } from 'lucide-react';
import useAuthStore from '../../store/auth.store';

const HistoryLaporan = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.peran === 'ADMIN_GLOBAL';

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">History Laporan</h2>
          <p className="page-subtitle">Riwayat seluruh laporan yang pernah disubmit.</p>
        </div>
      </div>

      <div className="card mb-4" style={{ padding: '16px 24px', marginBottom: '24px' }}>
        <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="flex gap-3" style={{ display: 'flex', gap: '12px' }}>
            <select className="form-control form-control-sm" style={{ width: 'auto', padding: '6px 12px' }}>
              <option>Semua Unit</option>
              <option>Unit Pusat</option>
              <option>DAOP 1</option>
            </select>
            <select className="form-control form-control-sm" style={{ width: 'auto', padding: '6px 12px' }}>
              <option>Semua Status</option>
              <option>TERVERIFIKASI</option>
              <option>MENUNGGU REVIEW</option>
              <option>PERLU REVISI</option>
            </select>
            <input type="month" className="form-control form-control-sm" style={{ width: 'auto', padding: '6px 12px' }} />
            <button className="btn btn-secondary btn-sm">Terapkan Filter</button>
          </div>
          <div className="flex gap-2" style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm">Export Excel</button>
            <button className="btn btn-secondary btn-sm">Export PDF</button>
          </div>
        </div>
      </div>

      <div className="card p-0" style={{ padding: 0 }}>
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Tgl Laporan</th>
                {isAdmin && <th>Unit</th>}
                <th>Jenis</th>
                <th>Disubmit Oleh</th>
                <th>Status</th>
                <th>Reviewer</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>08 Jun 2026</td>
                {isAdmin && <td>Unit DAOP 1</td>}
                <td>Data Harian</td>
                <td>Nama User</td>
                <td><span className="badge badge-diajukan">MENUNGGU REVIEW</span></td>
                <td>—</td>
                <td>
                  <button className="btn btn-secondary btn-sm py-1 px-2">
                    {isAdmin ? 'Review' : 'Lihat'}
                  </button>
                </td>
              </tr>
              <tr>
                <td>07 Jun 2026</td>
                {isAdmin && <td>Unit DAOP 1</td>}
                <td>Data Harian</td>
                <td>Nama User</td>
                <td><span className="badge badge-disetujui">TERVERIFIKASI</span></td>
                <td>Nama Admin</td>
                <td>
                  <button className="btn btn-secondary btn-sm py-1 px-2">
                    <Eye size={14} />
                  </button>
                </td>
              </tr>
              <tr>
                <td>06 Jun 2026</td>
                {isAdmin && <td>Unit DAOP 2</td>}
                <td>Data Penumpang</td>
                <td>User Lain</td>
                <td><span className="badge badge-revisi">PERLU REVISI</span></td>
                <td>Nama Admin</td>
                <td>
                  <button className="btn btn-secondary btn-sm py-1 px-2">
                    {isAdmin ? 'Review' : 'Edit'}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HistoryLaporan;
