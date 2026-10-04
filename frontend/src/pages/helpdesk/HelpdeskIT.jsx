import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, CheckCircle, Info, Loader2, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import usePermintaanStore from '../../store/permintaan.store';
import useAuthStore from '../../store/auth.store';
import { formatDateTime } from '../../utils/format';
import { API_ERROR_TOAST_ID } from '../../api/client';

const PAGE_SIZE = 20;

const HelpdeskIT = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const unitTabs = [
    { id: 'ALL', label: t('helpdesk_it.tab_all') },
    { id: 'KNA', label: 'KNA' },
    { id: 'BARANG', label: 'Barang' },
    { id: 'PENUMPANG', label: 'Penumpang' },
    { id: 'KEUANGAN', label: 'Keuangan' },
  ];

  const { user } = useAuthStore();
  const {
    permintaanList,
    pagination,
    error,
    fetchPermintaan,
    updateTanggapan,
    isLoading,
  } = usePermintaanStore();

  const [activeTab, setActiveTab] = useState('ALL');
  const [page, setPage] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deliveryState, setDeliveryState] = useState(null);

  useEffect(() => {
    fetchPermintaan({
      page,
      limit: PAGE_SIZE,
      ...(activeTab !== 'ALL' ? { unitCategory: activeTab } : {}),
    });
  }, [activeTab, fetchPermintaan, page]);

  const showDeliveryOutcome = (state) => {
    if (state === 'queued' || state === 'requeued') {
      toast.success(t('helpdesk_it.delivery_queued'));
      return;
    }
    if (state === 'duplicate') {
      toast(t('helpdesk_it.delivery_duplicate'), { icon: 'ℹ️' });
      return;
    }
    if (state === 'skipped') {
      toast(t('helpdesk_it.delivery_skipped'), { icon: '⚠️' });
      return;
    }
    toast.error(t('helpdesk_it.delivery_unknown'));
  };

  const handleUpdateStatus = async (id, status) => {
    setIsUpdating(true);
    try {
      const response = await updateTanggapan(id, { status });
      const updatedTicket = response?.data;
      const nextDeliveryState = updatedTicket?.delivery?.state || 'unknown';
      setDeliveryState(nextDeliveryState);

      if (['SELESAI', 'DITOLAK'].includes(status)) {
        showDeliveryOutcome(nextDeliveryState);
        setSelectedTicket(null);
      } else {
        toast.success(t('helpdesk_it.marked', { status }));
        setSelectedTicket((previous) => previous ? {
          ...previous,
          status: updatedTicket?.status || status,
        } : null);
      }
      return updatedTicket;
    } catch {
      toast.error(t('helpdesk_it.update_fail'), { id: API_ERROR_TOAST_ID });
      return null;
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSelectTicket = async (ticket) => {
    setDeliveryState(null);
    if (ticket.status !== 'MENUNGGU') {
      setSelectedTicket(ticket);
      return;
    }

    setSelectedTicket(ticket);
    const updated = await handleUpdateStatus(ticket.id, 'DIPROSES');
    if (!updated) setSelectedTicket(null);
  };

  const tickets = permintaanList.map(p => ({
    id: p.id_permintaan,
    displayId: `TKT-${String(p.id_permintaan).padStart(3, '0')}`,
    user: p.pengaju?.nama || t('helpdesk_it.unknown_user'),
    unit: p.pengaju?.unit?.nama_unit || t('helpdesk_it.central_unit'),
    waktu: formatDateTime(p.created_at, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }, lang),
    status: p.status, 
    desc: p.deskripsi,
    jenis: p.jenis
  }));

  const pageTitle = user?.peran === 'ADMIN_GLOBAL' ? t('helpdesk_it.title_revision') : t('helpdesk_it.title_system');

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="text-sm text-muted font-medium mb-1">Helpdesk <span className="mx-1">&gt;</span> <span className="text-primary">{t('helpdesk_it.breadcrumb')} - {pageTitle}</span></div>
        </div>
      </div>

      <div className="tabs mb-4" style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border)', marginBottom: '24px', overflowX: 'auto' }}>
        {unitTabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id);
              setPage(1);
              setSelectedTicket(null);
            }}
            style={{
              padding: '12px 4px',
              background: 'transparent',
              border: 'none',
              color: activeTab === tab.id ? '#1e293b' : '#94a3b8',
              borderBottom: activeTab === tab.id ? '2px solid #1e293b' : '2px solid transparent',
              fontWeight: activeTab === tab.id ? 600 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedTicket ? '1.5fr 1fr' : '1fr', gap: '24px' }}>
        
        {/* Kiri: Daftar Tiket */}
        <div>
          <div className="card p-0" style={{ padding: 0 }}>
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>{t('helpdesk_it.th_id')}</th>
                    <th>{t('helpdesk_it.th_user')}</th>
                    {activeTab === 'ALL' && !selectedTicket && <th>{t('helpdesk_it.th_unit')}</th>}
                    <th>{t('helpdesk_it.th_issue')}</th>
                    {!selectedTicket && <th>{t('helpdesk_it.th_time')}</th>}
                    <th>{t('helpdesk_it.th_status')}</th>
                    <th>{t('helpdesk_it.th_action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {error ? (
                    <tr>
                      <td colSpan={selectedTicket ? 5 : 7} style={{ textAlign: 'center', padding: '32px' }}>
                        <div role="alert" className="text-red-600 mb-3">{error}</div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => fetchPermintaan({
                            page,
                            limit: PAGE_SIZE,
                            ...(activeTab !== 'ALL' ? { unitCategory: activeTab } : {}),
                          })}
                        >
                          {t('helpdesk_it.retry')}
                        </button>
                      </td>
                    </tr>
                  ) : isLoading ? (
                    <tr><td colSpan={selectedTicket ? 5 : 7} style={{ textAlign: 'center', padding: '32px' }}>{t('helpdesk_it.loading')}</td></tr>
                  ) : tickets.map((ticket) => (
                    <tr key={ticket.id} style={{ background: selectedTicket?.id === ticket.id ? '#f8fafc' : 'transparent' }}>
                      <td style={{ fontWeight: 500 }}>{ticket.displayId}</td>
                      <td>
                        {ticket.user}
                        {selectedTicket?.id === ticket.id && <div className="text-xs text-muted mt-1">{ticket.unit}</div>}
                      </td>
                      {activeTab === 'ALL' && !selectedTicket && <td>{ticket.unit}</td>}
                      <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ticket.desc}
                      </td>
                      {!selectedTicket && <td>{ticket.waktu}</td>}
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '16px',
                          border: `1px solid ${ticket.status === 'MENUNGGU' ? '#f59e0b' : ticket.status === 'DIPROSES' ? '#0ea5e9' : ticket.status === 'SELESAI' ? '#10b981' : '#ef4444'}`,
                          fontSize: '12px',
                          fontWeight: 500,
                          color: ticket.status === 'MENUNGGU' ? '#d97706' : ticket.status === 'DIPROSES' ? '#0284c7' : ticket.status === 'SELESAI' ? '#059669' : '#dc2626',
                          backgroundColor: ticket.status === 'MENUNGGU' ? '#fef3c7' : ticket.status === 'DIPROSES' ? '#e0f2fe' : ticket.status === 'SELESAI' ? '#d1fae5' : '#fee2e2'
                        }}>
                          {ticket.status}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleSelectTicket(ticket)}
                          disabled={isUpdating}
                        >
                          {ticket.status === 'DIPROSES'
                            ? t('helpdesk_it.in_progress')
                            : ['SELESAI', 'DITOLAK'].includes(ticket.status)
                              ? t('helpdesk_it.view')
                              : t('helpdesk_it.handle')}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {tickets.length === 0 && !isLoading && !error && (
                    <tr>
                      <td colSpan={selectedTicket ? 5 : 7} style={{ textAlign: 'center', padding: '32px' }}>
                        <div className="text-muted">{t('helpdesk_it.empty')}</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <span className="text-sm text-muted">
                {t('helpdesk_it.total_tickets', { count: pagination?.total || 0 })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={!pagination?.hasPrevPage || isLoading}
                  onClick={() => {
                    setSelectedTicket(null);
                    setPage((current) => Math.max(1, current - 1));
                  }}
                >
                  {t('helpdesk_it.previous')}
                </button>
                <span className="text-sm text-muted">
                  {t('helpdesk_it.page_of', {
                    page: pagination?.page || page,
                    total: Math.max(1, pagination?.totalPages || 0),
                  })}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={!pagination?.hasNextPage || isLoading}
                  onClick={() => {
                    setSelectedTicket(null);
                    setPage((current) => current + 1);
                  }}
                >
                  {t('helpdesk_it.next')}
                </button>
              </div>
            </div>
          </div>

          {!selectedTicket && (
            <div className="mt-4 p-3 bg-blue-50 text-blue-800 rounded text-sm flex items-center gap-2">
              <Info className="w-4 h-4" />
              <span>{t('helpdesk_it.hint')}</span>
            </div>
          )}
        </div>

        {/* Kanan: Panel Handle */}
        {selectedTicket && (
          <div className="card" style={{ padding: '24px', height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
              <h3 className="font-bold text-lg m-0 text-slate-800">{t('helpdesk_it.panel_title', { id: selectedTicket.displayId })}</h3>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 p-1"
                onClick={() => setSelectedTicket(null)}
                aria-label={t('helpdesk_it.close_panel')}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="mb-6">
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                <p className="font-bold text-slate-800 text-base mb-1">{selectedTicket.user}</p>
                <p className="text-slate-500 text-sm mb-3">{t('helpdesk_it.unit_label')} <span className="font-medium text-slate-700">{selectedTicket.unit}</span></p>
                
                <div style={{ paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('helpdesk_it.issue_label', { type: selectedTicket.jenis.replace('_', ' ') })}</p>
                  <p className="text-slate-700 text-sm">{selectedTicket.desc}</p>
                </div>
              </div>
              
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                <p className="text-sm font-semibold text-slate-700 mb-3">{t('helpdesk_it.solution_label')}</p>
                <div
                  role="note"
                  style={{ padding: '16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', color: '#1e3a8a', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}
                >
                  <Info size={18} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    {['PERMINTAAN_AKSES', 'KLARIFIKASI_DATA'].includes(selectedTicket.jenis)
                      ? t('helpdesk_it.secure_token_info')
                      : t('helpdesk_it.status_notification_info')}
                  </span>
                </div>
                {deliveryState && (
                  <p className="mt-3 text-xs text-slate-500" role="status">
                    {t('helpdesk_it.delivery_state', { state: deliveryState })}
                  </p>
                )}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', display: 'flex', gap: '12px' }}>
              {!['SELESAI', 'DITOLAK'].includes(selectedTicket.status) && (
                <button
                  type="button"
                  className="btn w-full flex justify-center items-center gap-2"
                  style={{ background: isUpdating ? '#94a3b8' : '#dc2626', color: 'white' }}
                  onClick={() => {
                    if (window.confirm(t('helpdesk_it.reject_confirm'))) {
                      handleUpdateStatus(selectedTicket.id, 'DITOLAK');
                    }
                  }}
                  disabled={isUpdating}
                >
                  <Ban size={16} aria-hidden="true" />
                  {t('helpdesk_it.reject')}
                </button>
              )}
              <button
                type="button"
                className="btn w-full flex justify-center items-center gap-2"
                style={{
                  background: ['SELESAI', 'DITOLAK'].includes(selectedTicket.status) || isUpdating ? '#94a3b8' : '#10b981',
                  color: 'white',
                  cursor: ['SELESAI', 'DITOLAK'].includes(selectedTicket.status) || isUpdating ? 'not-allowed' : 'pointer',
                }}
                onClick={() => handleUpdateStatus(selectedTicket.id, 'SELESAI')}
                disabled={['SELESAI', 'DITOLAK'].includes(selectedTicket.status) || isUpdating}
              >
                {isUpdating ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle size={16} aria-hidden="true" />
                )}
                {['SELESAI', 'DITOLAK'].includes(selectedTicket.status)
                  ? t('helpdesk_it.terminal_status', { status: selectedTicket.status })
                  : isUpdating
                    ? t('helpdesk_it.updating')
                    : t('helpdesk_it.done_close')}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default HelpdeskIT;
