import React, { useState } from 'react';
import { PlusCircle, Search, Edit2, Trash2, Building2 } from 'lucide-react';

const dummyUnits = [
  { id: 'UNT001', nama: 'Unit DAOP 1', lokasi: 'Jakarta', totalUser: 12, status: 'Aktif' },
  { id: 'UNT002', nama: 'Unit DAOP 2', lokasi: 'Bandung', totalUser: 8, status: 'Aktif' },
  { id: 'UNT003', nama: 'Unit DAOP 3', lokasi: 'Cirebon', totalUser: 5, status: 'Aktif' },
  { id: 'UNT004', nama: 'Unit DAOP 4', lokasi: 'Semarang', totalUser: 0, status: 'Nonaktif' },
];

const ManajemenUnit = () => {
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="text-sm text-muted font-medium mb-1">Manajemen <span className="mx-1">&gt;</span> <span className="text-primary">Manajemen Unit</span></div>
          <p className="page-subtitle">Kelola struktur unit operasional sistem.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <PlusCircle size={18} /> Tambah Unit
        </button>
      </div>

      <div className="card mb-4" style={{ padding: '16px 24px', marginBottom: '24px' }}>
        <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="flex gap-3" style={{ display: 'flex', gap: '12px' }}>
            <select className="form-control form-control-sm" style={{ width: 'auto', padding: '6px 12px' }}>
              <option>Semua Status</option>
              <option>Aktif</option>
              <option>Nonaktif</option>
            </select>
          </div>
          <div className="flex gap-2" style={{ display: 'flex', gap: '8px' }}>
            <div className="relative" style={{ position: 'relative' }}>
              <Search className="absolute left-2.5 top-2 text-muted" size={16} style={{ position: 'absolute', left: '10px', top: '8px', color: 'var(--text-muted)' }} />
              <input type="text" className="form-control form-control-sm pl-8" placeholder="Cari unit..." style={{ paddingLeft: '32px' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {dummyUnits.map(unit => (
          <div key={unit.id} className="card relative" style={{ padding: '24px' }}>
            <div className="flex justify-between items-start mb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div className="flex items-center gap-3" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-400" style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-400)' }}>
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-primary">{unit.nama}</h3>
                  <p className="text-xs text-muted mt-1">ID: {unit.id}</p>
                </div>
              </div>
              <span className={`badge ${unit.status === 'Aktif' ? 'badge-disetujui' : 'badge-revisi'}`}>
                {unit.status}
              </span>
            </div>

            <div className="divider"></div>

            <div className="flex justify-between items-center text-sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
              <div>
                <p className="text-muted mb-1">Lokasi</p>
                <p className="font-medium text-primary">{unit.lokasi}</p>
              </div>
              <div className="text-right">
                <p className="text-muted mb-1">Total User</p>
                <p className="font-medium text-primary">{unit.totalUser} Akun</p>
              </div>
            </div>

            <div className="mt-4 flex gap-2" style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary btn-sm w-full" style={{ flex: 1, justifyContent: 'center' }}>
                <Edit2 size={14} className="mr-1" /> Edit
              </button>
              <button className="btn btn-secondary btn-sm" style={{ padding: '0 12px', color: 'var(--danger)', borderColor: 'var(--border)' }}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Tambah Unit Baru</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <div className="form-group">
              <label className="form-label">Nama Unit</label>
              <input type="text" className="form-control" placeholder="Contoh: Unit DAOP 5" />
            </div>
            <div className="form-group">
              <label className="form-label">Lokasi / Wilayah</label>
              <input type="text" className="form-control" placeholder="Contoh: Purwokerto" />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-control">
                <option value="Aktif">Aktif</option>
                <option value="Nonaktif">Nonaktif</option>
              </select>
            </div>

            <div className="modal-footer mt-4">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={() => setShowModal(false)}>Simpan Unit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManajemenUnit;
