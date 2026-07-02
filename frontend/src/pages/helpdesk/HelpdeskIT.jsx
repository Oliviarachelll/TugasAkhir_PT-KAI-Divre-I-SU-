import React, { useState, useEffect } from 'react';
import { RefreshCw, X, MessageSquare, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import usePermintaanStore from '../../store/permintaan.store';
import useAuthStore from '../../store/auth.store';

const unitTabs = ['Semua', 'KNA', 'Barang', 'Penumpang', 'Keuangan'];

const HelpdeskIT = () => {
  const { user } = useAuthStore();
  const { permintaanList, fetchPermintaan, updateTanggapan, isLoading } = usePermintaanStore();
  
  const [activeTab, setActiveTab] = useState('Semua');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [generatedToken, setGeneratedToken] = useState('XX - XXXXXX');
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
    const formattedToken = `${token.substring(0, 2)} - ${token.substring(2)}`;
    setGeneratedToken(formattedToken);
    setSendSuccess(false);
  };

  const handleKirimWA = () => {
    if (generatedToken === 'XX - XXXXXX') return;
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setSendSuccess(true);
    }, 1500);
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await updateTanggapan(id, { status });
      toast.success(`Tiket ditandai ${status}`);
      if (status === 'SELESAI') {
        setSelectedTicket(null);
      } else {
        setSelectedTicket(prev => prev ? { ...prev, status } : null);
      }
    } catch (error) {
      toast.error('Gagal memperbarui status tiket');
    }
  };

  const tickets = permintaanList.map(p => ({
    id: p.id_permintaan,
    displayId: `TKT-${String(p.id_permintaan).padStart(3, '0')}`,
    user: p.pengaju?.nama || 'Unknown',
    unit: p.pengaju?.unit?.nama_unit || 'Unit Pusat',
    waktu: new Date(p.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
    status: p.status, 
    desc: p.deskripsi,
    jenis: p.jenis
  }));

  const filteredTickets = tickets.filter(ticket => {
    if (activeTab === 'Semua') return true;
    const unitLower = ticket.unit.toLowerCase();
    const tabLower = activeTab.toLowerCase();
    if (tabLower === 'kna' && (unitLower.includes('kna') || unitLower.includes('kontrak'))) return true;
    if (tabLower === 'barang' && unitLower.includes('barang')) return true;
    if (tabLower === 'penumpang' && unitLower.includes('penumpang')) return true;
    if (tabLower === 'keuangan' && unitLower.includes('keuangan')) return true;
    return false;
  });

  const pageTitle = user?.peran === 'ADMIN_GLOBAL' ? 'Permintaan Revisi Laporan' : 'Akses & Sistem';

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="text-sm text-muted font-medium mb-1">Helpdesk <span className="mx-1">&gt;</span> <span className="text-primary">Manajemen Helpdesk - {pageTitle}</span></div>
        </div>
      </div>

      <div className="tabs mb-4" style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border)', marginBottom: '24px', overflowX: 'auto' }}>
        {unitTabs.map(tab => {
          let count = 0;
          if (tab === 'Semua') {
            count = tickets.length;
          } else {
            count = tickets.filter(t => {
              const uLower = t.unit.toLowerCase();
              const tLower = tab.toLowerCase();
              if (tLower === 'kna' && (uLower.includes('kna') || uLower.includes('kontrak'))) return true;
              if (tLower === 'barang' && uLower.includes('barang')) return true;
              if (tLower === 'penumpang' && uLower.includes('penumpang')) return true;
              if (tLower === 'keuangan' && uLower.includes('keuangan')) return true;
              return false;
            }).length;
          }
            
          return (
            <button 
              key={tab}
              className={`tab-item ${activeTab === tab ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab);
                setSelectedTicket(null);
              }}
              style={{ 
                padding: '12px 4px', 
                background: 'transparent', 
                border: 'none', 
                color: activeTab === tab ? '#1e293b' : '#94a3b8',
                borderBottom: activeTab === tab ? '2px solid #1e293b' : '2px solid transparent',
                fontWeight: activeTab === tab ? 600 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {tab} ({count})
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
                    <th>ID TIKET</th>
                    <th>NAMA USER</th>
                    {activeTab === 'Semua' && !selectedTicket && <th>UNIT</th>}
                    <th>KENDALA</th>
                    {!selectedTicket && <th>WAKTU</th>}
                    <th>STATUS</th>
                    <th>AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && tickets.length === 0 ? (
                    <tr><td colSpan={selectedTicket ? 5 : 7} style={{ textAlign: 'center', padding: '32px' }}>Memuat data...</td></tr>
                  ) : filteredTickets.map(ticket => (
                    <tr key={ticket.id} style={{ background: selectedTicket?.id === ticket.id ? '#f8fafc' : 'transparent' }}>
                      <td style={{ fontWeight: 500 }}>{ticket.displayId}</td>
                      <td>
                        {ticket.user}
                        {selectedTicket?.id === ticket.id && <div className="text-xs text-muted mt-1">{ticket.unit}</div>}
                      </td>
                      {activeTab === 'Semua' && !selectedTicket && <td>{ticket.unit}</td>}
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
                            setGeneratedToken('XX - XXXXXX');
                            setSendSuccess(false);
                          }}
                        >
                          {ticket.status === 'DIPROSES' ? 'Handle' : ticket.status === 'SELESAI' ? 'Lihat' : 'Tanggapi'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredTickets.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={selectedTicket ? 5 : 7} style={{ textAlign: 'center', padding: '32px' }}>
                        <div className="text-muted">Tidak ada tiket/permintaan di tab ini.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          {!selectedTicket && (
            <div style={{ padding: '16px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b', fontSize: '14px', marginTop: '24px', textAlign: 'center' }}>
              ℹ️ Klik tombol <strong>Tanggapi</strong> pada baris tiket untuk membuka panel penanganan dan mengubah status.
            </div>
          )}
        </div>

        {/* Kanan: Panel Handle */}
        {selectedTicket && (
          <div className="card" style={{ padding: '24px', height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
              <h3 className="font-bold text-lg m-0 text-slate-800">Penanganan {selectedTicket.displayId}</h3>
              <button className="text-slate-400 hover:text-slate-600 p-1" onClick={() => setSelectedTicket(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="mb-6">
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                <p className="font-bold text-slate-800 text-base mb-1">{selectedTicket.user}</p>
                <p className="text-slate-500 text-sm mb-3">Unit: <span className="font-medium text-slate-700">{selectedTicket.unit}</span></p>
                
                <div style={{ paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Kendala/Deskripsi ({selectedTicket.jenis.replace('_', ' ')})</p>
                  <p className="text-slate-700 text-sm">{selectedTicket.desc}</p>
                </div>
              </div>
              
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                <label className="text-sm font-semibold text-slate-700 mb-3 block">Berikan Solusi / Token Akses</label>
                
                <div 
                  style={{ padding: '24px', background: 'linear-gradient(to right, #f8fafc, #f1f5f9)', border: '1px solid #cbd5e1', borderRadius: '8px', textAlign: 'center', marginBottom: '20px' }}
                >
                  <div className="text-3xl font-mono font-bold tracking-widest text-slate-800 mb-3" style={{ letterSpacing: '4px' }}>
                    {generatedToken}
                  </div>
                  <div className="flex items-center justify-center gap-3 text-sm text-slate-500">
                    <span>Berlaku 1 jam</span>
                    <span>•</span>
                    <button className="text-primary hover:text-brand-600 flex items-center gap-1 font-medium" onClick={handleGenerateToken}>
                      <RefreshCw size={14} /> Regenerate
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
                    {isSending ? 'Mengirim pesan...' : 'Kirim Token via WhatsApp / Email'}
                  </button>
                </div>

                {sendSuccess && (
                  <div style={{ padding: '12px 16px', background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: '6px', color: '#166534', fontSize: '14px', marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#166534' }}></div>
                    Pesan berhasil dikirim ke {selectedTicket.user}
                  </div>
                )}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', display: 'flex', gap: '12px' }}>
              <button 
                className="btn w-full flex justify-center items-center gap-2" 
                style={{ background: '#10b981', color: 'white' }} 
                onClick={() => handleUpdateStatus(selectedTicket.id, 'SELESAI')}
                disabled={selectedTicket.status === 'SELESAI'}
              >
                <CheckCircle size={16} />
                {selectedTicket.status === 'SELESAI' ? 'Sudah Selesai' : 'Selesai & Tutup Tiket'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default HelpdeskIT;
