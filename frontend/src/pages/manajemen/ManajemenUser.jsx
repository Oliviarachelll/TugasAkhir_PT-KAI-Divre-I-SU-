import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { penggunaApi } from '../../api/pengguna.api';
import { unitApi } from '../../api/unit.api';
import toast from 'react-hot-toast';
import { Pencil, Trash2, Lock, Unlock } from 'lucide-react';

const ManajemenUser = () => {
  const { t } = useTranslation();
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
      toast.error(t('manajemen.user.fetch_fail'));
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
    if (!window.confirm(t('manajemen.user.confirm_delete'))) return;
    try {
      await penggunaApi.delete(id);
      toast.success(t('manajemen.user.delete_success'));
      fetchData();
    } catch (error) {
      toast.error(error?.response?.data?.error || t('manajemen.user.delete_fail'));
    }
  };

  const handleToggleLock = async (id, isLocked) => {
    try {
      await penggunaApi.unlock(id, { terkunci: !isLocked });
      toast.success(isLocked ? t('manajemen.user.unlock_success') : t('manajemen.user.lock_success'));
      fetchData();
    } catch (error) {
      toast.error(error?.response?.data?.error || t('manajemen.user.status_fail'));
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
        return toast.error(t('manajemen.user.need_unit'));
      }

      if (editingId) {
        if (!payload.kata_sandi) delete payload.kata_sandi; // Jangan kirim kalau kosong
        await penggunaApi.update(editingId, payload);
        toast.success(t('manajemen.user.update_success'));
      } else {
        await penggunaApi.create(payload);
        toast.success(t('manajemen.user.create_success'));
      }
      
      setShowModal(false);
      setEditingId(null);
      fetchData();
    } catch (error) {
      toast.error(error?.response?.data?.error || t('manajemen.user.generic_error'));
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
          <div className="text-sm text-muted font-medium mb-1">{t('manajemen.title')} <span className="mx-1">&gt;</span> <span className="text-primary">{t('manajemen.user.breadcrumb')}</span></div>
        </div>
      </div>

      <div className="flex gap-3 mb-4 items-center" style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <input 
          type="text" 
          className="form-control form-control-sm" 
          placeholder={t('manajemen.user.search_ph')} 
          style={{ width: '250px', padding: '8px 12px' }} 
        />
        <select className="form-control form-control-sm" style={{ width: 'auto', padding: '8px 24px 8px 12px' }}>
          <option>{t('manajemen.user.filter_a')}</option>
        </select>
        <select className="form-control form-control-sm" style={{ width: 'auto', padding: '8px 24px 8px 12px' }}>
          <option>{t('manajemen.user.filter_b')}</option>
        </select>
        <button 
          className="btn btn-secondary btn-sm" 
          style={{ backgroundColor: '#cbd5e1', color: '#1e293b', border: '1px solid #94a3b8', padding: '8px 16px' }}
          onClick={openAddModal}
        >
          {t('manajemen.user.add')}
        </button>
      </div>

      <div className="card p-0" style={{ padding: 0 }}>
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>{t('manajemen.user.th_name')}</th>
                <th>{t('manajemen.user.th_email')}</th>
                <th>{t('manajemen.user.th_role')}</th>
                <th>{t('manajemen.user.th_unit')}</th>
                <th>{t('manajemen.user.th_status')}</th>
                <th>{t('manajemen.user.th_action')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="6" className="text-center p-4">{t('manajemen.user.loading')}</td></tr>
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
                      <span className="badge badge-revisi">{t('manajemen.user.locked')}</span>
                    ) : (
                      <span className="badge badge-disetujui">{t('manajemen.user.active')}</span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-3 items-center">
                      <button className="text-brand-500 hover:text-brand-600 transition-colors" onClick={() => handleEdit(u)} title={t('manajemen.user.edit_title')}>
                        <Pencil size={18} />
                      </button>
                      <button className="text-danger hover:text-red-700 transition-colors" onClick={() => handleDelete(u.id_pengguna)} title={t('manajemen.user.delete_title')}>
                        <Trash2 size={18} />
                      </button>
                      <button className="text-gray-500 hover:text-gray-700 transition-colors" onClick={() => handleToggleLock(u.id_pengguna, u.terkunci)} title={u.terkunci ? t('manajemen.user.unlock_title') : t('manajemen.user.lock_title')}>
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
              <h3 className="font-bold text-base text-gray-800">{t('manajemen.user.modal_title')}</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-x-6 gap-y-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
              <div className="form-group mb-0">
                <label className="form-label text-sm mb-1 text-gray-500">{t('manajemen.user.name')}</label>
                <input type="text" className="form-control" placeholder={t('manajemen.user.name_ph')} value={formData.nama} onChange={(e) => setFormData({...formData, nama: e.target.value})} />
              </div>
              <div className="form-group mb-0">
                <label className="form-label text-sm mb-1 text-gray-500">{t('manajemen.user.role')}</label>
                <select className="form-control text-gray-800" value={formData.peran} onChange={(e) => setFormData({...formData, peran: e.target.value})}>
                  <option value="USER_UNIT">{t('manajemen.user.role_unit')}</option>
                  <option value="ADMIN_GLOBAL">{t('manajemen.user.role_admin')}</option>
                  <option value="IT">{t('manajemen.user.role_it')}</option>
                </select>
              </div>
              
              <div className="form-group mb-0">
                <label className="form-label text-sm mb-1 text-gray-500">Email</label>
                <input type="email" className="form-control" placeholder="Email..." value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="form-group mb-0">
                <label className="form-label text-sm mb-1 text-gray-500">{t('manajemen.user.unit_label')}</label>
                <select className="form-control text-gray-800" value={formData.id_unit} onChange={(e) => setFormData({...formData, id_unit: e.target.value})}>
                  <option value="">{t('manajemen.user.unit_ph')}</option>
                  {(units || []).map(unit => (
                    <option key={unit.id_unit} value={unit.id_unit}>{unit.nama_unit} ({unit.jenis_unit})</option>
                  ))}
                </select>
              </div>

              <div className="form-group mb-0">
                <label className="form-label text-sm mb-1 text-gray-500">{t('manajemen.user.phone')}</label>
                <input type="text" className="form-control" placeholder={t('manajemen.user.phone_ph')} value={formData.no_hp} onChange={(e) => setFormData({...formData, no_hp: e.target.value})} />
              </div>
              <div className="form-group mb-0">
                <label className="form-label text-sm mb-1 text-gray-500">{t('manajemen.user.password')}</label>
                <input type="text" className="form-control font-medium" placeholder={editingId ? t('manajemen.user.password_edit_ph') : t('manajemen.user.password_ph')} value={formData.kata_sandi} onChange={(e) => setFormData({...formData, kata_sandi: e.target.value})} />
              </div>
            </div>

            <div className="flex gap-2 mt-6" style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary text-sm px-4 py-1.5" style={{ backgroundColor: '#f8fafc', border: '1px solid #94a3b8' }} onClick={() => setShowModal(false)}>{t('manajemen.user.cancel')}</button>
              <button className="btn btn-secondary text-sm px-4 py-1.5" style={{ backgroundColor: '#cbd5e1', color: '#1e293b', border: '1px solid #94a3b8' }} onClick={handleSubmit}>{t('manajemen.user.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManajemenUser;
