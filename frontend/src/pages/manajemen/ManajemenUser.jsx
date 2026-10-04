import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { API_ERROR_TOAST_ID } from '../../api/client';
import { penggunaApi } from '../../api/pengguna.api';
import { unitApi } from '../../api/unit.api';
import toast from 'react-hot-toast';
import { Pencil, Trash2, Lock, Unlock, Search, X, RotateCcw } from 'lucide-react';

const ManajemenUser = () => {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [units, setUnits] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [filterUnit, setFilterUnit] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  
  const [formData, setFormData] = useState({
    nama: '',
    email: '',
    peran: 'USER_UNIT',
    id_unit: '',
    no_hp: '',
    kata_sandi: 'kai12345678'
  });
  const [editingId, setEditingId] = useState(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [userRes, unitRes] = await Promise.all([
        penggunaApi.getAll({ limit: 100 }),
        unitApi.getAll({ limit: 100 })
      ]);
      setUsers(userRes.data || []);
      setUnits(unitRes.data || []);
    } catch (error) {
      toast.error(t('manajemen.user.fetch_fail'), { id: API_ERROR_TOAST_ID });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const isFiltered = Boolean(
    searchQuery.trim() ||
    filterRole !== 'ALL' ||
    filterUnit !== 'ALL' ||
    filterStatus !== 'ALL'
  );

  const resetFilters = () => {
    setSearchQuery('');
    setFilterRole('ALL');
    setFilterUnit('ALL');
    setFilterStatus('ALL');
  };

  const filteredUsers = useMemo(() => {
    return (users || []).filter((u) => {
      // 1. Search Query (nama, email, no_hp, unit, peran)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nama = (u.nama || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const noHp = (u.no_hp || '').toLowerCase();
        const unitName = (u.unit?.nama_unit || '').toLowerCase();
        const peran = (u.peran || '').toLowerCase();

        const match =
          nama.includes(q) ||
          email.includes(q) ||
          noHp.includes(q) ||
          unitName.includes(q) ||
          peran.includes(q);

        if (!match) return false;
      }

      // 2. Role Filter
      if (filterRole !== 'ALL' && u.peran !== filterRole) {
        return false;
      }

      // 3. Unit Filter
      if (filterUnit !== 'ALL') {
        const userUnitId = u.unit?.id_unit ?? u.id_unit;
        if (String(userUnitId) !== String(filterUnit)) {
          return false;
        }
      }

      // 4. Status Filter
      if (filterStatus === 'ACTIVE' && u.terkunci) {
        return false;
      }
      if (filterStatus === 'LOCKED' && !u.terkunci) {
        return false;
      }

      return true;
    });
  }, [users, searchQuery, filterRole, filterUnit, filterStatus]);

  const handleEdit = (user) => {
    setEditingId(user.id_pengguna);
    setFormData({
      nama: user.nama,
      email: user.email,
      peran: user.peran,
      id_unit: user.unit?.id_unit ? String(user.unit.id_unit) : (user.id_unit ? String(user.id_unit) : ''),
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
      toast.error(error?.response?.data?.error || t('manajemen.user.delete_fail'), { id: API_ERROR_TOAST_ID });
    }
  };

  const handleToggleLock = async (id, isLocked) => {
    try {
      await penggunaApi.unlock(id, { terkunci: !isLocked });
      toast.success(isLocked ? t('manajemen.user.unlock_success') : t('manajemen.user.lock_success'));
      fetchData();
    } catch (error) {
      toast.error(error?.response?.data?.error || t('manajemen.user.status_fail'), { id: API_ERROR_TOAST_ID });
    }
  };

  const handleSubmit = async () => {
    try {
      const payload = { ...formData };
      
      // Parse id_unit jika ada
      if (payload.id_unit) {
        payload.id_unit = parseInt(payload.id_unit, 10);
      } else {
        delete payload.id_unit;
      }

      // Validasi id_unit untuk pembuatan user baru (karena skema database mewajibkan unit)
      if (!editingId && !payload.id_unit) {
        return toast.error(t('manajemen.user.need_unit_all'));
      }

      // Validasi unit khusus untuk USER_UNIT
      if (payload.peran === 'USER_UNIT' && !payload.id_unit) {
        return toast.error(t('manajemen.user.need_unit'));
      }

      // Validasi password minimal 10 karakter jika diisi
      if (!editingId && (!payload.kata_sandi || payload.kata_sandi.length < 10)) {
        return toast.error(t('manajemen.user.password_min_len'));
      }

      if (editingId) {
        if (!payload.kata_sandi) {
          delete payload.kata_sandi; // Jangan kirim kalau kosong
        } else if (payload.kata_sandi.length < 10) {
          return toast.error(t('manajemen.user.password_min_len'));
        }
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
      toast.error(error?.response?.data?.error || t('manajemen.user.generic_error'), { id: API_ERROR_TOAST_ID });
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ 
      nama: '', 
      email: '', 
      peran: 'USER_UNIT', 
      id_unit: units[0]?.id_unit ? String(units[0].id_unit) : '', 
      no_hp: '', 
      kata_sandi: 'kai12345678' 
    });
    setShowModal(true);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="text-sm text-muted font-medium mb-1">
            {t('manajemen.title')} <span className="mx-1">&gt;</span> <span className="text-primary">{t('manajemen.user.breadcrumb')}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mb-4 items-center flex-wrap" style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '250px' }}>
          <Search 
            size={16} 
            style={{ 
              position: 'absolute', 
              left: '10px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              color: '#94a3b8', 
              pointerEvents: 'none' 
            }} 
          />
          <input 
            type="text" 
            className="form-control form-control-sm" 
            placeholder={t('manajemen.user.search_ph')} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '8px 30px 8px 32px' }} 
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: '2px',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Peran / Role */}
        <select 
          className="form-control form-control-sm" 
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          style={{ width: 'auto', padding: '8px 24px 8px 12px' }}
        >
          <option value="ALL">{t('manajemen.user.filter_role_all')}</option>
          <option value="USER_UNIT">{t('manajemen.user.role_unit')}</option>
          <option value="ADMIN_GLOBAL">{t('manajemen.user.role_admin')}</option>
          <option value="IT">{t('manajemen.user.role_it')}</option>
        </select>

        {/* Filter Unit */}
        <select 
          className="form-control form-control-sm" 
          value={filterUnit}
          onChange={(e) => setFilterUnit(e.target.value)}
          style={{ width: 'auto', maxWidth: '220px', padding: '8px 24px 8px 12px' }}
        >
          <option value="ALL">{t('manajemen.user.filter_unit_all')}</option>
          {(units || []).map((u) => (
            <option key={u.id_unit} value={u.id_unit}>
              {u.nama_unit}
            </option>
          ))}
        </select>

        {/* Filter Status */}
        <select 
          className="form-control form-control-sm" 
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ width: 'auto', padding: '8px 24px 8px 12px' }}
        >
          <option value="ALL">{t('manajemen.user.filter_status_all')}</option>
          <option value="ACTIVE">{t('manajemen.user.filter_status_active')}</option>
          <option value="LOCKED">{t('manajemen.user.filter_status_locked')}</option>
        </select>

        {isFiltered && (
          <button 
            type="button"
            className="btn btn-sm" 
            onClick={resetFilters}
            style={{ 
              padding: '8px 12px', 
              border: '1px solid #cbd5e1', 
              color: '#475569', 
              backgroundColor: '#f8fafc',
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px' 
            }}
            title={t('manajemen.user.filter_clear')}
          >
            <RotateCcw size={14} />
            <span>{t('manajemen.user.filter_clear')}</span>
          </button>
        )}

        <button 
          className="btn btn-secondary btn-sm" 
          style={{ backgroundColor: '#cbd5e1', color: '#1e293b', border: '1px solid #94a3b8', padding: '8px 16px' }}
          onClick={openAddModal}
        >
          {t('manajemen.user.add')}
        </button>
      </div>

      <div style={{ marginBottom: '8px', paddingLeft: '2px', fontSize: '13px', color: '#64748b' }}>
        {isFiltered
          ? t('manajemen.user.showing_users', { count: filteredUsers.length, total: users.length })
          : t('manajemen.user.showing_all_users', { count: users.length })}
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
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center" style={{ padding: '36px 16px', color: '#64748b' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <p style={{ margin: 0, fontWeight: 500, fontSize: '14px' }}>
                        {t('manajemen.user.no_data')}
                      </p>
                      {isFiltered && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={resetFilters}
                          style={{ border: '1px solid #cbd5e1', padding: '4px 12px', fontSize: '12px', backgroundColor: '#f1f5f9' }}
                        >
                          {t('manajemen.user.filter_clear')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
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
                ))
              )}
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
