import React, { useState } from 'react';
import { PlusCircle, Search, Edit2, Trash2, KeyRound } from 'lucide-react';

const dummyUsers = [
  { id: 'USR001', nama: 'Budi Santoso', email: 'budi@rache.id', peran: 'USER_UNIT', unit: 'Unit DAOP 1', status: 'Aktif' },
  { id: 'USR002', nama: 'Siti Aminah', email: 'siti@rache.id', peran: 'ADMIN_GLOBAL', unit: 'Pusat', status: 'Aktif' },
  { id: 'USR003', nama: 'Andi Irawan', email: 'andi@rache.id', peran: 'IT', unit: 'Pusat', status: 'Aktif' },
  { id: 'USR004', nama: 'Eko Prasetyo', email: 'eko@rache.id', peran: 'USER_UNIT', unit: 'Unit DAOP 2', status: 'Terkunci' },
];

const ManajemenUser = () => {
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Manajemen User</h2>
          <p className="page-subtitle">Kelola akun pengguna, peran, dan penugasan unit.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <PlusCircle size={18} /> Tambah User
        </button>
      </div>

      <div className="card mb-4" style={{ padding: '16px 24px', marginBottom: '24px' }}>
        <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="flex gap-3" style={{ display: 'flex', gap: '12px' }}>
            <select className="form-control form-control-sm" style={{ width: 'auto', padding: '6px 12px' }}>
              <option>Semua Peran</option>
              <option>IT</option>
              <option>ADMIN_GLOBAL</option>
              <option>USER_UNIT</option>
            </select>
            <select className="form-control form-control-sm" style={{ width: 'auto', padding: '6px 12px' }}>
              <option>Semua Unit</option>
              <option>Pusat</option>
              <option>DAOP 1</option>
              <option>DAOP 2</option>
            </select>
            <select className="form-control form-control-sm" style={{ width: 'auto', padding: '6px 12px' }}>
              <option>Status Aktif</option>
              <option>Terkunci</option>
            </select>
          </div>
          <div className="flex gap-2" style={{ display: 'flex', gap: '8px' }}>
            <div className="relative" style={{ position: 'relative' }}>
              <Search className="absolute left-2.5 top-2 text-muted" size={16} style={{ position: 'absolute', left: '10px', top: '8px', color: 'var(--text-muted)' }} />
              <input type="text" className="form-control form-control-sm pl-8" placeholder="Cari nama/email..." style={{ paddingLeft: '32px' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="card p-0" style={{ padding: 0 }}>
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Nama Lengkap</th>
                <th>Email / Username</th>
                <th>Peran</th>
                <th>Unit Tugas</th>
                <th>Status</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {dummyUsers.map(u => (
                <tr key={u.id}>
                  <td className="font-medium text-primary">{u.nama}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className="badge" style={{ 
                      background: u.peran === 'IT' ? 'rgba(236,72,153,0.1)' : u.peran === 'ADMIN_GLOBAL' ? 'rgba(99,102,241,0.1)' : 'rgba(56,189,248,0.1)',
                      color: u.peran === 'IT' ? 'var(--accent-rose)' : u.peran === 'ADMIN_GLOBAL' ? 'var(--brand-400)' : 'var(--info)',
                      border: 'none'
                    }}>
                      {u.peran}
                    </span>
                  </td>
                  <td>{u.unit}</td>
                  <td>
                    {u.status === 'Aktif' ? (
                      <span className="badge badge-disetujui">AKTIF</span>
                    ) : (
                      <span className="badge badge-revisi" style={{ background: 'rgba(251,113,133,0.1)', color: 'var(--danger)' }}>TERKUNCI</span>
                    )}
                  </td>
                  <td>
                    <div className="flex justify-end gap-2" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      {u.status === 'Terkunci' && (
                        <button className="btn btn-secondary btn-sm py-1 px-2 text-success" title="Buka Kunci" style={{ color: 'var(--success)', borderColor: 'var(--success)' }}>
                          <KeyRound size={14} />
                        </button>
                      )}
                      <button className="btn btn-secondary btn-sm py-1 px-2 text-brand-400" title="Edit">
                        <Edit2 size={14} />
                      </button>
                      <button className="btn btn-secondary btn-sm py-1 px-2 text-danger" title="Hapus">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Tambah User Baru</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <div className="grid grid-cols-2 gap-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Nama Lengkap</label>
                <input type="text" className="form-control" placeholder="Nama lengkap user" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-control" placeholder="email@rache.id" />
              </div>
              
              <div className="form-group">
                <label className="form-label">Peran (Role)</label>
                <select className="form-control">
                  <option value="USER_UNIT">USER_UNIT (Admin Unit)</option>
                  <option value="ADMIN_GLOBAL">ADMIN_GLOBAL (Pusat)</option>
                  <option value="IT">IT (Support)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Unit Penugasan</label>
                <select className="form-control">
                  <option value="">Pilih Unit...</option>
                  <option value="1">Unit DAOP 1</option>
                  <option value="2">Unit DAOP 2</option>
                </select>
              </div>

              <div className="form-group col-span-2" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Kata Sandi Awal</label>
                <div className="flex gap-2" style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" className="form-control" value="Rache2026!" readOnly />
                  <button className="btn btn-secondary text-sm px-3" style={{ padding: '0 12px' }}>Generate</button>
                </div>
                <p className="text-xs text-muted mt-1">User harus mengganti kata sandi pada login pertama.</p>
              </div>
            </div>

            <div className="modal-footer mt-4">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={() => setShowModal(false)}>Simpan User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManajemenUser;
