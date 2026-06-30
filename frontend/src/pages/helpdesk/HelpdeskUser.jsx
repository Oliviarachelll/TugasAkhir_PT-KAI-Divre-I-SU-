import React, { useState } from 'react';
import { PlusCircle, Search } from 'lucide-react';

const HelpdeskUser = () => {
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('Semua Status');
  const [searchQuery, setSearchQuery] = useState('');

  const [tickets] = useState([
    { id: 'TKT-001', date: '08 Jun 2026', category: 'Lupa Password', desc: 'Mohon direset password untuk akun ini...', status: 'IN PROGRESS', action: 'Sedang ditangani oleh Admin IT' },
    { id: 'TKT-002', date: '01 Jun 2026', category: 'Buka Kunci Akun', desc: 'Salah input password 3x', status: 'RESOLVED', action: 'Kunci akun telah dibuka' },
    { id: 'TKT-003', date: '15 Jun 2026', category: 'Buka Akses Laporan', desc: 'Mohon akses edit untuk LPR-123 karena ada salah input KNA', status: 'RESOLVED', action: <span><strong>Token: 8X9A2B</strong>. Silakan gunakan token ini untuk edit.</span> }
  ]);

  const filteredTickets = tickets.filter(ticket => {
    const matchStatus = statusFilter === 'Semua Status' || ticket.status === statusFilter;
    const matchSearch = ticket.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        ticket.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        ticket.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="text-sm text-muted font-medium mb-1">Helpdesk <span className="mx-1">&gt;</span> <span className="text-primary">Helpdesk & Bantuan</span></div>

        </div>
      </div>

      <div className="card mb-4" style={{ padding: '16px 24px', marginBottom: '24px' }}>
        <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="flex gap-3" style={{ display: 'flex', gap: '12px' }}>
            <select 
              className="form-control form-control-sm" 
              style={{ width: 'auto', padding: '6px 12px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option>Semua Status</option>
              <option>OPEN</option>
              <option>IN PROGRESS</option>
              <option>RESOLVED</option>
            </select>
          </div>
          <div className="flex gap-2" style={{ display: 'flex', gap: '8px' }}>
            <div className="relative" style={{ position: 'relative' }}>
              <Search className="absolute left-2.5 top-2 text-muted" size={16} style={{ position: 'absolute', left: '10px', top: '8px', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                className="form-control form-control-sm pl-8" 
                placeholder="Cari tiket..." 
                style={{ paddingLeft: '32px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="btn btn-primary btn-sm ml-2" onClick={() => setShowModal(true)}>
              <PlusCircle size={16} /> Buat Tiket Baru
            </button>
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
              {filteredTickets.length > 0 ? (
                filteredTickets.map(ticket => (
                  <tr key={ticket.id}>
                    <td className="font-medium text-primary">{ticket.id}</td>
                    <td>{ticket.date}</td>
                    <td>{ticket.category}</td>
                    <td>{ticket.desc}</td>
                    <td>
                      <span className={`badge ${ticket.status === 'RESOLVED' ? 'badge-disetujui' : ticket.status === 'IN PROGRESS' ? 'badge-diajukan' : 'badge-ditolak'}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td>{ticket.action}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-4 text-muted">Tidak ada tiket yang ditemukan.</td>
                </tr>
              )}
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
                <option value="TIPE_C">TIPE C - Request Buka Akses Edit Laporan ACC</option>
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
