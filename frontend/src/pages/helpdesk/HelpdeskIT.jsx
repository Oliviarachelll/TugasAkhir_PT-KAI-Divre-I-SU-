import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, X, MessageSquare, CheckCircle, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import usePermintaanStore from '../../store/permintaan.store';
import useAuthStore from '../../store/auth.store';
import { formatDateTime } from '../../utils/format';

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
  const { permintaanList, fetchPermintaan, updateTanggapan, isLoading } = usePermintaanStore();
  
  const [activeTab, setActiveTab] = useState('ALL');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [generatedToken, setGeneratedToken] = useState('XX-XXXXXX');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  useEffect(() => {
    fetchPermintaan();
  }, [fetchPermintaan]);

  const handleGenerateToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = '';
    for (let i = 0; i < 8; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const formattedToken = `${token.substring(0, 2)}-${token.substring(2)}`;
    setGeneratedToken(formattedToken);
    setSendSuccess(false);
  };

  const handleKirimWA = () => {
    if (generatedToken === 'XX-XXXXXX') return;
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setSendSuccess(true);
    }, 1500);
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      const payload = { status };
      if (status === 'SELESAI' && generatedToken !== 'XX-XXXXXX') {
        payload.token = generatedToken; // Send exact token as generated
      }
      await updateTanggapan(id, payload);
      toast.success(t('helpdesk_it.marked', { status }));
      if (status === 'SELESAI') {
        setSelectedTicket(null);
      } else {
        setSelectedTicket(prev => prev ? { ...prev, status } : null);
      }
    } catch (error) {
      toast.error(t('helpdesk_it.update_fail'));
    }
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

  const matchTab = (unitName, tabId) => {
    if (tabId === 'ALL') return true;
    const unitLower = (unitName || '').toLowerCase();
    if (tabId === 'KNA' && (unitLower.includes('kna') || unitLower.includes('kontrak'))) return true;
    if (tabId === 'BARANG' && unitLower.includes('barang')) return true;
    if (tabId === 'PENUMPANG' && unitLower.includes('penumpang')) return true;
    if (tabId === 'KEUANGAN' && unitLower.includes('keuangan')) return true;
    return false;
  };

  const filteredTickets = tickets.filter(ticket => matchTab(ticket.unit, activeTab));

  const pageTitle = user?.peran === 'ADMIN_GLOBAL' ? t('helpdesk_it.title_revision') : t('helpdesk_it.title_system');

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="text-sm text-muted font-medium mb-1">Helpdesk <span className="mx-1">&gt;</span> <span className="text-primary">{t('helpdesk_it.breadcrumb')} - {pageTitle}</span></div>
        </div>
      </div>

      <div className="tabs mb-4" style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border)', marginBottom: '24px', overflowX: 'auto' }}>
        {unitTabs.map(tab => {
          const count = tickets.filter(tk => matchTab(tk.unit, tab.id)).length;
            
          return (
            <button 
              key={tab.id}
              className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id);
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
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label} ({count})
            </button>
          );
        })}
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
                  {isLoading && tickets.length === 0 ? (
                    <tr><td colSpan={selectedTicket ? 5 : 7} style={{ textAlign: 'center', padding: '32px' }}>{t('helpdesk_it.loading')}</td></tr>
                  ) : filteredTickets.map(ticket => (
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
                          style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}
                          onClick={() => {
                            if (ticket.status === 'MENUNGGU') {
                              handleUpdateStatus(ticket.id, 'DIPROSES');
                            }
                            setSelectedTicket(ticket);
                            setGeneratedToken('XX-XXXXXX');
                            setSendSuccess(false);
                          }}
                        >
                          {ticket.status === 'DIPROSES' ? t('helpdesk_it.in_progress') : ticket.status === 'SELESAI' ? t('helpdesk_it.view') : t('helpdesk_it.handle')}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredTickets.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={selectedTicket ? 5 : 7} style={{ textAlign: 'center', padding: '32px' }}>
                        <div className="text-muted">{t('helpdesk_it.empty')}</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
              <button className="text-slate-400 hover:text-slate-600 p-1" onClick={() => setSelectedTicket(null)}>
                <X size={20} />
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
                <label className="text-sm font-semibold text-slate-700 mb-3 block">{t('helpdesk_it.solution_label')}</label>
                
                <div 
                  style={{ padding: '24px', background: 'linear-gradient(to right, #f8fafc, #f1f5f9)', border: '1px solid #cbd5e1', borderRadius: '8px', textAlign: 'center', marginBottom: '20px' }}
                >
                  <div className="text-3xl font-mono font-bold tracking-widest text-slate-800 mb-3" style={{ letterSpacing: '4px' }}>
                    {generatedToken}
                  </div>
                  <div className="flex items-center justify-center gap-3 text-sm text-slate-500">
                    <span>{t('helpdesk_it.valid_hour')}</span>
                    <span>•</span>
                    <button className="text-primary hover:text-brand-600 flex items-center gap-1 font-medium" onClick={handleGenerateToken}>
                      <RefreshCw size={14} /> {t('helpdesk_it.regenerate')}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    className="btn btn-primary w-full flex justify-center items-center gap-2" 
                    onClick={handleKirimWA}
                    disabled={isSending || generatedToken === 'XX - XXXXXX' || selectedTicket.status === 'SELESAI'}
                  >
                    <MessageSquare size={16} />
                    {isSending ? t('helpdesk_it.sending') : sendSuccess ? t('helpdesk_it.resend') : t('helpdesk_it.send_token')}
                  </button>
                </div>

                {sendSuccess && (
                  <div style={{ padding: '12px 16px', background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: '6px', color: '#166534', fontSize: '14px', marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#166534' }}></div>
                    {t('helpdesk_it.sent_to', { user: selectedTicket.user })}
                  </div>
                )}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', display: 'flex', gap: '12px' }}>
              <button 
                className="btn w-full flex justify-center items-center gap-2" 
                style={{ background: (selectedTicket.status === 'SELESAI' || (generatedToken !== 'XX-XXXXXX' && !sendSuccess)) ? '#94a3b8' : '#10b981', color: 'white', cursor: (selectedTicket.status === 'SELESAI' || (generatedToken !== 'XX-XXXXXX' && !sendSuccess)) ? 'not-allowed' : 'pointer' }} 
                onClick={() => handleUpdateStatus(selectedTicket.id, 'SELESAI')}
                disabled={selectedTicket.status === 'SELESAI' || (generatedToken !== 'XX-XXXXXX' && !sendSuccess)}
              >
                <CheckCircle size={16} />
                {selectedTicket.status === 'SELESAI' ? t('helpdesk_it.already_done') : (generatedToken !== 'XX-XXXXXX' && !sendSuccess) ? t('helpdesk_it.must_send_first') : t('helpdesk_it.done_close')}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default HelpdeskIT;
