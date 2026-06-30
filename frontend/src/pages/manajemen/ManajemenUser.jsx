import React, { useState } from 'react';

const dummyUsers = [
  { id: 'USR001', nama: 'Nama User 1', email: 'email@domain.id', role: 'Role A', unit: 'Nama Unit', status: 'Aktif' },
  { id: 'USR002', nama: 'Nama User 2', email: 'email@domain.id', role: 'Role B', unit: '—', status: 'Aktif' },
  { id: 'USR003', nama: 'Nama User 3', email: 'email@domain.id', role: 'Role A', unit: 'Nama Unit', status: 'Terkunci' },
  { id: 'USR004', nama: 'Nama User 4', email: 'email@domain.id', role: 'Role C', unit: '—', status: 'Aktif' },
  { id: 'USR005', nama: 'Nama User 5', email: 'email@domain.id', role: 'Role A', unit: 'Nama Unit', status: 'Aktif' },
];

const ManajemenUser = () => {
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="text-sm text-muted font-medium mb-1">Manajemen <span className="mx-1">&gt;</span> <span className="text-primary">Manajemen User</span></div>
        </div>
      </div>

      <div className="flex gap-3 mb-4 items-center" style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <input 
          type="text" 
          className="form-control form-control-sm" 
          placeholder="Cari nama / email..." 
          style={{ width: '250px', padding: '8px 12px' }} 
        />
        <select className="form-control form-control-sm" style={{ width: 'auto', padding: '8px 24px 8px 12px' }}>
          <option>Filter A</option>
        </select>
        <select className="form-control form-control-sm" style={{ width: 'auto', padding: '8px 24px 8px 12px' }}>
          <option>Filter B</option>
        </select>
        <button 
          className="btn btn-secondary btn-sm" 
          style={{ backgroundColor: '#cbd5e1', color: '#1e293b', border: '1px solid #94a3b8', padding: '8px 16px' }}
          onClick={() => setShowModal(true)}
        >
          + Tambah User Baru
        </button>
      </div>

      <div className="card p-0" style={{ padding: 0 }}>
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>NAMA</th>
                <th>EMAIL</th>
                <th>ROLE</th>
                <th>UNIT</th>
                <th>STATUS</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {dummyUsers.map(u => (
                <tr key={u.id}>
                  <td>{u.nama}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.unit}</td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: '16px',
                      border: '1px solid #94a3b8',
                      fontSize: '12px',
                      color: '#475569',
                      backgroundColor: 'transparent'
                    }}>
                      {u.status}
                    </span>
                  </td>
                  <td>
                    <button className="text-brand-500 hover:underline mr-1" onClick={() => setShowModal(true)}>
                      [edit]
                    </button>
                    {u.status === 'Aktif' ? (
                       <button className="text-brand-500 hover:underline">
                         [kunci]
                       </button>
                    ) : (
                       <button className="text-brand-500 hover:underline">
                         [buka]
                       </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" style={{ alignItems: 'center' }}>
          <div className="modal" style={{ maxWidth: '800px', width: '100%', padding: '24px' }}>
            <div className="mb-4">
              <h3 className="font-bold text-base text-gray-800">Modal Tambah / Edit User</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-x-6 gap-y-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
              <div className="form-group mb-0">
                <label className="form-label text-sm mb-1 text-gray-500">Nama Lengkap</label>
                <input type="text" className="form-control" placeholder="Nama Lengkap..." />
              </div>
              <div className="form-group mb-0">
                <label className="form-label text-sm mb-1 text-gray-500">Role</label>
                <select className="form-control text-gray-400">
                  <option value="">Pilih Role</option>
                </select>
              </div>
              
              <div className="form-group mb-0">
                <label className="form-label text-sm mb-1 text-gray-500">Email</label>
                <input type="email" className="form-control" placeholder="Email..." />
              </div>
              <div className="form-group mb-0">
                <label className="form-label text-sm mb-1 text-gray-500">Unit (jika Role terkait)</label>
                <select className="form-control text-gray-400">
                  <option value="">Pilih Unit</option>
                </select>
              </div>

              <div className="form-group mb-0">
                <label className="form-label text-sm mb-1 text-gray-500">No. Kontak</label>
                <input type="text" className="form-control" placeholder="No. Kontak..." />
              </div>
              <div className="form-group mb-0">
                <label className="form-label text-sm mb-1 text-gray-500">Password (auto-generated, tampil sekali)</label>
                <input type="text" className="form-control font-medium" value="XXXXXXXXXX" readOnly style={{ backgroundColor: '#f1f5f9' }} />
              </div>
            </div>

            <div className="flex gap-2 mt-6" style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary text-sm px-4 py-1.5" style={{ backgroundColor: '#f8fafc', border: '1px solid #94a3b8' }} onClick={() => setShowModal(false)}>Batal</button>
              <button className="btn btn-secondary text-sm px-4 py-1.5" style={{ backgroundColor: '#cbd5e1', color: '#1e293b', border: '1px solid #94a3b8' }} onClick={() => setShowModal(false)}>Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManajemenUser;
