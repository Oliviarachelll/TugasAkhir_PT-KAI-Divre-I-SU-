import React, { useState } from 'react';
import { PlusCircle, Search } from 'lucide-react';

const HelpdeskUser = () => {
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Helpdesk & Bantuan</h2>
          <p className="page-subtitle">Ajukan tiket bantuan ke IT Support untuk kendala sistem.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <PlusCircle size={18} /> Buat Tiket Baru
        </button>
      </div>

      <div className="card mb-4" style={{ padding: '16px 24px', marginBottom: '24px' }}>
        <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="flex gap-3" style={{ display: 'flex', gap: '12px' }}>
            <select className="form-control form-control-sm" style={{ width: 'auto', padding: '6px 12px' }}>
              <option>Semua Status</option>
              <option>OPEN</option>
              <option>IN PROGRESS</option>
              <option>RESOLVED</option>
            </select>
          </div>
          <div className="flex gap-2" style={{ display: 'flex', gap: '8px' }}>
            <div className="relative" style={{ position: 'relative' }}>
              <Search className="absolute left-2.5 top-2 text-muted" size={16} style={{ position: 'absolute', left: '10px', top: '8px', color: 'var(--text-muted)' }} />
              <input type="text" className="form-control form-control-sm pl-8" placeholder="Cari tiket..." style={{ paddingLeft: '32px' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="card p-0" style={{ padding: 0 }}>
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>ID Tiket</th>
                <th>Tanggal</th>
                <th>Kategori</th>
                <th>Keterangan</th>
                <th>Status</th>
                <th>Tindakan IT</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-medium text-primary">TKT-001</td>
                <td>08 Jun 2026</td>
                <td>Lupa Password</td>
                <td>Mohon direset password untuk akun ini...</td>
                <td><span className="badge badge-diajukan">IN PROGRESS</span></td>
                <td>Sedang ditangani oleh Admin IT</td>
              </tr>
              <tr>
                <td className="font-medium text-primary">TKT-002</td>
                <td>01 Jun 2026</td>
                <td>Buka Kunci Akun</td>
                <td>Salah input password 3x</td>
                <td><span className="badge badge-disetujui">RESOLVED</span></td>
                <td>Kunci akun telah dibuka</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Buat Tiket Bantuan</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <div className="form-group">
              <label className="form-label">Kategori Bantuan</label>
              <select className="form-control">
                <option value="">Pilih Kategori...</option>
                <option value="TIPE_A">TIPE A - Lupa Password / Reset Akses</option>
                <option value="TIPE_B">TIPE B - Buka Kunci Akun / Banned</option>
                <option value="LAINNYA">Lainnya - Kendala Sistem</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Deskripsi Kendala</label>
              <textarea 
                className="form-control" 
                rows="4" 
                placeholder="Jelaskan secara detail kendala yang Anda alami..."
              ></textarea>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={() => setShowModal(false)}>Kirim Tiket</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpdeskUser;
