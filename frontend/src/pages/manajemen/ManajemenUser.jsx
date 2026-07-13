import React, { useState, useEffect } from 'react';
import { penggunaApi } from '../../api/pengguna.api';
import { unitApi } from '../../api/unit.api';
import toast from 'react-hot-toast';
import { Pencil, Trash2, Lock, Unlock } from 'lucide-react';

const ManajemenUser = () => {
  const [showModal, setShowModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [units, setUnits] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    nama: '',
    email: '',
    peran: 'USER_UNIT',
    id_unit: '',
    no_hp: '',
    kata_sandi: 'kai12345'
  });
  const [editingId, setEditingId] = useState(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [userRes, unitRes] = await Promise.all([
        penggunaApi.getAll({ limit: 100 }),
        unitApi.getAll({ limit: 100 })
      ]);
      setUsers(userRes.data);
      setUnits(unitRes.data);
    } catch (error) {
      toast.error('Gagal mengambil data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEdit = (user) => {
    setEditingId(user.id_pengguna);
    setFormData({
      nama: user.nama,
      email: user.email,
      peran: user.peran,
      id_unit: user.unit?.id_unit || '',
      no_hp: user.no_hp || '',
      kata_sandi: '' // Kosongkan saat edit agar tidak wajib ubah password
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus pengguna ini?')) return;
    try {
      await penggunaApi.delete(id);
      toast.success('Pengguna berhasil dihapus');
      fetchData();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Gagal menghapus pengguna');
    }
  };

  const handleToggleLock = async (id, isLocked) => {
    try {
      await penggunaApi.unlock(id, { terkunci: !isLocked });
      toast.success(isLocked ? 'Akses pengguna dibuka' : 'Akses pengguna dikunci');
      fetchData();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Gagal mengubah status');
    }
  };

  const handleSubmit = async () => {
    try {
      const payload = { ...formData };
      
      // Parse id_unit jika ada, jika tidak hapus dari payload (khusus admin/IT yg boleh tanpa unit)
      if (payload.id_unit) {
        payload.id_unit = parseInt(payload.id_unit);
      } else {
        delete payload.id_unit;
      }

      // Validasi unit untuk USER_UNIT
      if (payload.peran === 'USER_UNIT' && !payload.id_unit) {
        return toast.error('Silakan pilih unit untuk role USER UNIT');
      }

      if (editingId) {
        if (!payload.kata_sandi) delete payload.kata_sandi; // Jangan kirim kalau kosong
        await penggunaApi.update(editingId, payload);
        toast.success('Data pengguna diperbarui');
      } else {
        await penggunaApi.create(payload);
        toast.success('Pengguna baru ditambahkan');
      }
      
      setShowModal(false);
      setEditingId(null);
      fetchData();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Terjadi kesalahan');
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ nama: '', email: '', peran: 'USER_UNIT', id_unit: '', no_hp: '', kata_sandi: 'kai12345' });
    setShowModal(true);
  };

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
          onClick={openAddModal}
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
              {isLoading ? (
                <tr><td colSpan="6" className="text-center p-4">Memuat data...</td></tr>
              ) : (users || []).map(u => (
                <tr key={u.id_pengguna}>
                  <td>
                    <div className="font-bold text-gray-800">{u.nama}</div>
                    <div className="text-xs text-gray-500 mt-1">{u.no_hp || '-'}</div>
                  </td>
                  <td className="text-gray-600">{u.email}</td>
                  <td>
                    <span className="badge badge-disetujui">{u.peran}</span>
                  </td>
                  <td className="text-gray-600">{u.unit?.nama_unit || '-'}</td>
                  <td>
                    {u.terkunci ? (
                      <span className="badge badge-revisi">Terkunci</span>
                    ) : (
                      <span className="badge badge-disetujui">Aktif</span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-3 items-center">
                      <button className="text-brand-500 hover:text-brand-600 transition-colors" onClick={() => handleEdit(u)} title="Edit User">
                        <Pencil size={18} />
                      </button>
                      <button className="text-danger hover:text-red-700 transition-colors" onClick={() => handleDelete(u.id_pengguna)} title="Hapus User">
                        <Trash2 size={18} />
                      </button>
                      <button className="text-gray-500 hover:text-gray-700 transition-colors" onClick={() => handleToggleLock(u.id_pengguna, u.terkunci)} title={u.terkunci ? "Buka Akses" : "Kunci Akses"}>
                        {u.terkunci ? <Unlock size={18} /> : <Lock size={18} />}
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
        <div className="modal-overlay" style={{ alignItems: 'center' }}>
          <div className="modal" style={{ maxWidth: '800px', width: '100%', padding: '24px' }}>
            <div className="mb-4">
              <h3 className="font-bold text-base text-gray-800">Modal Tambah / Edit User</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-x-6 gap-y-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
              <div className="form-group mb-0">
                <label className="form-label text-sm mb-1 text-gray-500">Nama Lengkap</label>
                <input type="text" className="form-control" placeholder="Nama Lengkap..." value={formData.nama} onChange={(e) => setFormData({...formData, nama: e.target.value})} />
              </div>
              <div className="form-group mb-0">
                <label className="form-label text-sm mb-1 text-gray-500">Role</label>
                <select className="form-control text-gray-800" value={formData.peran} onChange={(e) => setFormData({...formData, peran: e.target.value})}>
                  <option value="USER_UNIT">User Unit</option>
                  <option value="ADMIN_GLOBAL">Admin Global</option>
                  <option value="IT">IT Support</option>
                </select>
              </div>
              
              <div className="form-group mb-0">
                <label className="form-label text-sm mb-1 text-gray-500">Email</label>
                <input type="email" className="form-control" placeholder="Email..." value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="form-group mb-0">
                <label className="form-label text-sm mb-1 text-gray-500">Unit (jika Role terkait)</label>
                <select className="form-control text-gray-800" value={formData.id_unit} onChange={(e) => setFormData({...formData, id_unit: e.target.value})}>
                  <option value="">Pilih Unit</option>
                  {(units || []).map(unit => (
                    <option key={unit.id_unit} value={unit.id_unit}>{unit.nama_unit} ({unit.jenis_unit})</option>
                  ))}
                </select>
              </div>

              <div className="form-group mb-0">
                <label className="form-label text-sm mb-1 text-gray-500">No. Kontak (WA)</label>
                <input type="text" className="form-control" placeholder="Contoh: 0831..." value={formData.no_hp} onChange={(e) => setFormData({...formData, no_hp: e.target.value})} />
              </div>
              <div className="form-group mb-0">
                <label className="form-label text-sm mb-1 text-gray-500">Password</label>
                <input type="text" className="form-control font-medium" placeholder={editingId ? '(Kosongkan jika tidak ingin ganti)' : 'kai12345'} value={formData.kata_sandi} onChange={(e) => setFormData({...formData, kata_sandi: e.target.value})} />
              </div>
            </div>

            <div className="flex gap-2 mt-6" style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary text-sm px-4 py-1.5" style={{ backgroundColor: '#f8fafc', border: '1px solid #94a3b8' }} onClick={() => setShowModal(false)}>Batal</button>
              <button className="btn btn-secondary text-sm px-4 py-1.5" style={{ backgroundColor: '#cbd5e1', color: '#1e293b', border: '1px solid #94a3b8' }} onClick={handleSubmit}>Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManajemenUser;
