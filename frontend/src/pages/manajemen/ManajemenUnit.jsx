import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { API_ERROR_TOAST_ID } from '../../api/client';
import { PlusCircle, Search, Edit2, Trash2, Building2 } from 'lucide-react';
import { unitApi } from '../../api/unit.api';
import toast from 'react-hot-toast';

const ManajemenUnit = () => {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [units, setUnits] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ nama_unit: '', jenis_unit: 'DAERAH' });
  const [editingId, setEditingId] = useState(null);

  const fetchUnits = async () => {
    setIsLoading(true);
    try {
      const res = await unitApi.getAll({ limit: 100 });
      setUnits(res.data);
    } catch (error) {
      toast.error(t('manajemen.unit.fetch_fail'), { id: API_ERROR_TOAST_ID });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  const handleEdit = (unit) => {
    setEditingId(unit.id_unit);
    setFormData({ nama_unit: unit.nama_unit, jenis_unit: unit.jenis_unit });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('manajemen.unit.confirm_delete'))) return;
    try {
      await unitApi.delete(id);
      toast.success(t('manajemen.unit.delete_success'));
      fetchUnits();
    } catch (error) {
      toast.error(error?.response?.data?.error || t('manajemen.unit.delete_fail'), { id: API_ERROR_TOAST_ID });
    }
  };

  const handleSubmit = async () => {
    try {
      if (editingId) {
        await unitApi.update(editingId, formData);
        toast.success(t('manajemen.unit.update_success'));
      } else {
        await unitApi.create(formData);
        toast.success(t('manajemen.unit.create_success'));
      }
      setShowModal(false);
      setFormData({ nama_unit: '', jenis_unit: 'DAERAH' });
      setEditingId(null);
      fetchUnits();
    } catch (error) {
      toast.error(error?.response?.data?.error || t('manajemen.unit.generic_error'), { id: API_ERROR_TOAST_ID });
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ nama_unit: '', jenis_unit: 'DAERAH' });
    setShowModal(true);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="text-sm text-muted font-medium mb-1">{t('manajemen.title')} <span className="mx-1">&gt;</span> <span className="text-primary">{t('manajemen.unit.breadcrumb')}</span></div>
          <p className="page-subtitle">{t('manajemen.unit.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <PlusCircle size={18} /> {t('manajemen.unit.add')}
        </button>
      </div>

      <div className="card mb-4" style={{ padding: '16px 24px', marginBottom: '24px' }}>
        <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="flex gap-3" style={{ display: 'flex', gap: '12px' }}>
            <select className="form-control form-control-sm" style={{ width: 'auto', padding: '6px 12px' }}>
              <option>{t('manajemen.unit.filter_all')}</option>
              <option>{t('manajemen.unit.filter_active')}</option>
              <option>{t('manajemen.unit.filter_inactive')}</option>
            </select>
          </div>
          <div className="flex gap-2" style={{ display: 'flex', gap: '8px' }}>
            <div className="relative" style={{ position: 'relative' }}>
              <Search className="absolute left-2.5 top-2 text-muted" size={16} style={{ position: 'absolute', left: '10px', top: '8px', color: 'var(--text-muted)' }} />
              <input type="text" className="form-control form-control-sm pl-8" placeholder={t('manajemen.unit.search_ph')} style={{ paddingLeft: '32px' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {isLoading ? <p className="text-muted">{t('manajemen.unit.loading')}</p> : (units || []).map(unit => (
          <div key={unit.id_unit} className="card relative" style={{ padding: '24px' }}>
            <div className="flex justify-between items-start mb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div className="flex items-center gap-3" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-400" style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-400)' }}>
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-primary">{unit.nama_unit}</h3>
                  <p className="text-xs text-muted mt-1">ID: {unit.id_unit}</p>
                </div>
              </div>
              <span className={`badge badge-disetujui`}>
                {t('manajemen.unit.active')}
              </span>
            </div>

            <div className="divider"></div>

            <div className="flex justify-between items-center text-sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
              <div>
                <p className="text-muted mb-1">{t('manajemen.unit.type_label')}</p>
                <p className="font-medium text-primary">{unit.jenis_unit}</p>
              </div>
              <div className="text-right">
                <p className="text-muted mb-1">{t('manajemen.unit.total_user')}</p>
                <p className="font-medium text-primary">{t('manajemen.unit.account_count', { count: unit._count?.pengguna || 0 })}</p>
              </div>
            </div>

            <div className="mt-4 flex gap-2" style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary btn-sm w-full" style={{ flex: 1, justifyContent: 'center' }} onClick={() => handleEdit(unit)}>
                <Edit2 size={14} className="mr-1" /> {t('manajemen.unit.edit')}
              </button>
              <button className="btn btn-secondary btn-sm" style={{ padding: '0 12px', color: 'var(--danger)', borderColor: 'var(--border)' }} onClick={() => handleDelete(unit.id_unit)}>
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
              <h3 className="modal-title">{t('manajemen.unit.modal_title')}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <div className="form-group">
              <label className="form-label">{t('manajemen.unit.name')}</label>
              <input type="text" className="form-control" placeholder={t('manajemen.unit.name_ph')} value={formData.nama_unit} onChange={(e) => setFormData({...formData, nama_unit: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('manajemen.unit.type')}</label>
              <select className="form-control" value={formData.jenis_unit} onChange={(e) => setFormData({...formData, jenis_unit: e.target.value})}>
                <option value="PUSAT">PUSAT</option>
                <option value="DAERAH">DAERAH</option>
                <option value="CABANG">CABANG</option>
              </select>
            </div>

            <div className="modal-footer mt-4">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('manajemen.unit.cancel')}</button>
              <button className="btn btn-primary" onClick={handleSubmit}>{t('manajemen.unit.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManajemenUnit;
