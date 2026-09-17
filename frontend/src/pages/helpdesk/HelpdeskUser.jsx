import React, { useState, useEffect } from 'react';
import { PlusCircle, Search } from 'lucide-react';
import useAuthStore from '../../store/auth.store';
import usePermintaanStore from '../../store/permintaan.store';
import useLaporanStore from '../../store/laporan.store';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../utils/format';
import toast from 'react-hot-toast';

const HelpdeskUser = () => {
  const { user } = useAuthStore();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  
  const { permintaanList, fetchPermintaan, addPermintaan, isLoading } = usePermintaanStore();
  const { laporanList, fetchLaporan } = useLaporanStore();

  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL_STATUS');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [formJenis, setFormJenis] = useState('');
  const [formDeskripsi, setFormDeskripsi] = useState('');
  const [formIdLaporan, setFormIdLaporan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchPermintaan();
    fetchLaporan();
  }, [fetchPermintaan, fetchLaporan]);

  const handleSubmit = async () => {
    if (!formJenis || !formDeskripsi) {
      toast.error(t('helpdesk.need_category'));
      return;
    }
    
    if (formJenis === 'KLARIFIKASI_DATA' && !formIdLaporan) {
      toast.error(t('helpdesk.need_report'));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        jenis: formJenis,
        deskripsi: formDeskripsi
      };
      if (formIdLaporan) {
        payload.id_laporan = parseInt(formIdLaporan);
      }
      
      await addPermintaan(payload);
      toast.success(t('helpdesk.create_success'));
      setShowModal(false);
      setFormJenis('');
      setFormDeskripsi('');
      setFormIdLaporan('');
    } catch (error) {
      toast.error(t('helpdesk.create_fail'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTickets = permintaanList.filter(ticket => {
    const matchStatus = statusFilter === 'ALL_STATUS' || ticket.status === statusFilter;
    const matchSearch = String(ticket.id_permintaan).includes(searchQuery) || 
                        ticket.jenis.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        ticket.deskripsi.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  const getStatusBadge = (status) => {
    switch(status) {
      case 'MENUNGGU': return 'badge-diajukan';
      case 'DIPROSES': return 'badge-diajukan';
      case 'SELESAI': return 'badge-disetujui';
      case 'DITOLAK': return 'badge-ditolak';
      default: return 'badge-diajukan';
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="text-sm text-muted font-medium mb-1">{t('menu.helpdesk')} <span className="mx-1">&gt;</span> <span className="text-primary">{t('helpdesk.title')}</span></div>
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
              <option value="ALL_STATUS">{t('helpdesk.status.all')}</option>
              <option value="MENUNGGU">MENUNGGU</option>
              <option value="DIPROSES">DIPROSES</option>
              <option value="SELESAI">SELESAI</option>
              <option value="DITOLAK">DITOLAK</option>
            </select>
          </div>
          <div className="flex gap-2" style={{ display: 'flex', gap: '8px' }}>
            <div className="relative" style={{ position: 'relative' }}>
              <Search className="absolute left-2.5 top-2 text-muted" size={16} style={{ position: 'absolute', left: '10px', top: '8px', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                className="form-control form-control-sm pl-8" 
                placeholder={t('helpdesk.search')} 
                style={{ paddingLeft: '32px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="btn btn-primary btn-sm ml-2" onClick={() => setShowModal(true)}>
              <PlusCircle size={16} /> {t('helpdesk.new_ticket')}
            </button>
          </div>
        </div>
      </div>

      <div className="card p-0" style={{ padding: 0 }}>
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>{t('helpdesk.table.id')}</th>
                <th>{t('helpdesk.table.date')}</th>
                <th>{t('helpdesk.table.category')}</th>
                <th>{t('helpdesk.table.desc')}</th>
                <th>{t('helpdesk.table.status')}</th>
                <th>{t('helpdesk.table.handler')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && permintaanList.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-4 text-muted">{t('helpdesk.loading')}</td></tr>
              ) : filteredTickets.length > 0 ? (
                filteredTickets.map(ticket => (
                  <tr key={ticket.id_permintaan}>
                    <td className="font-medium text-primary">TKT-{String(ticket.id_permintaan).padStart(3, '0')}</td>
                    <td>{formatDate(ticket.created_at, undefined, lang)}</td>
                    <td>{ticket.jenis.replace('_', ' ')}</td>
                    <td>{ticket.deskripsi}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(ticket.status)}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td>{ticket.penanggung?.nama || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-4 text-muted">{t('helpdesk.empty')}</td>
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
              <h3 className="modal-title">{t('helpdesk.modal_title')}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <div className="form-group">
              <label className="form-label">{t('helpdesk.category')}</label>
              <select className="form-control" value={formJenis} onChange={e => {
                setFormJenis(e.target.value);
                if (e.target.value !== 'KLARIFIKASI_DATA') setFormIdLaporan('');
              }}>
                <option value="">{t('helpdesk.category_ph')}</option>
                <option value="PERMINTAAN_AKSES">{t('helpdesk.cat_access')}</option>
                <option value="BANTUAN_TEKNIS">{t('helpdesk.cat_technical')}</option>
                <option value="KLARIFIKASI_DATA">{t('helpdesk.cat_revision')}</option>
                <option value="LAINNYA">{t('helpdesk.cat_other')}</option>
              </select>
            </div>

            {formJenis === 'KLARIFIKASI_DATA' && (
              <div className="form-group">
                <label className="form-label">{t('helpdesk.choose_report')}</label>
                <select className="form-control" value={formIdLaporan} onChange={e => setFormIdLaporan(e.target.value)}>
                  <option value="">{t('helpdesk.choose_report_ph')}</option>
                  {laporanList.filter(l => l.status === 'DISETUJUI').map(l => (
                    <option key={l.id_laporan} value={l.id_laporan}>
                      {t('helpdesk.report_option', { date: formatDate(l.tanggal, undefined, lang), unit: l.unit?.nama_unit })}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">{t('helpdesk.desc_label')}</label>
              <textarea 
                className="form-control" 
                rows="4" 
                placeholder={t('helpdesk.desc_ph')}
                value={formDeskripsi}
                onChange={e => setFormDeskripsi(e.target.value)}
              ></textarea>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={isSubmitting}>{t('helpdesk.cancel')}</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? t('helpdesk.sending') : t('helpdesk.send')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpdeskUser;
