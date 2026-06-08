import React, { useState } from 'react';
import { Send, RefreshCw, X, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

const dummyTickets = [
  { id: 'TKT-001', user: 'Nama User 1', unit: 'Unit DAOP 1', wa: '+6281234567890', status: 'IN PROGRESS', type: 'TIPE A' },
  { id: 'TKT-002', user: 'Nama User 2', unit: 'Unit Pusat', wa: '+6289876543210', status: 'OPEN', type: 'TIPE B' },
  { id: 'TKT-003', user: 'Nama User 3', unit: 'Unit DAOP 2', wa: '+6285554443332', status: 'OPEN', type: 'TIPE A' },
];

const HelpdeskIT = () => {
  const [activeTab, setActiveTab] = useState('TIPE A');
  const [selectedTicket, setSelectedTicket] = useState(dummyTickets[0]);
  const [generatedToken, setGeneratedToken] = useState('XX - XXXXXX');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  const handleGenerateToken = () => {
    // Simulasi generate token 8 karakter alphanumeric
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = '';
    for (let i = 0; i < 8; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const formattedToken = `${token.substring(0, 2)} - ${token.substring(2)}`;
    setGeneratedToken(formattedToken);
    setSendSuccess(false);
    toast.success('Token berhasil digenerate');
  };

  const handleKirimWA = () => {
    if (generatedToken === 'XX - XXXXXX') {
      toast.error('Generate token terlebih dahulu');
      return;
    }
    
    setIsSending(true);
    // Simulasi kirim via WA (Socket.io/Baileys di backend)
    setTimeout(() => {
      setIsSending(false);
      setSendSuccess(true);
      toast.success('Token berhasil dikirim via WhatsApp');
    }, 1500);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Manajemen Helpdesk</h2>
          <p className="page-subtitle">Tangani tiket dari user dan generate token akses.</p>
        </div>
      </div>

      <div className="tabs mb-4" style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        {['TIPE A', 'TIPE B', 'Semua'].map(tab => (
          <button 
            key={tab}
            className={`tab-item ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
            style={{ 
              padding: '12px 4px', 
              background: 'transparent', 
              border: 'none', 
              color: activeTab === tab ? 'var(--brand-400)' : 'var(--text-muted)',
              borderBottom: activeTab === tab ? '2px solid var(--brand-400)' : '2px solid transparent',
              fontWeight: activeTab === tab ? 600 : 500,
              cursor: 'pointer'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* Kiri: Daftar Tiket */}
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID TIKET</th>
                  <th>NAMA USER</th>
                  <th>STATUS</th>
                  <th>AKSI</th>
                </tr>
              </thead>
              <tbody>
                {dummyTickets.map(ticket => (
                  <tr key={ticket.id} className={selectedTicket?.id === ticket.id ? 'bg-card-2' : ''} style={{ background: selectedTicket?.id === ticket.id ? 'var(--bg-card-2)' : 'transparent' }}>
                    <td className="font-medium">{ticket.id}</td>
                    <td>{ticket.user}</td>
                    <td>
                      <span className={`badge ${ticket.status === 'OPEN' ? 'badge-revisi' : 'badge-diajukan'}`} 
                            style={ticket.status === 'OPEN' ? { background: 'rgba(56,189,248,0.12)', color: 'var(--info)' } : {}}>
                        {ticket.status}
                      </span>
                    </td>
                    <td>
                      <button 
                        className={`btn btn-sm ${selectedTicket?.id === ticket.id ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => {
                          setSelectedTicket(ticket);
                          setGeneratedToken('XX - XXXXXX');
                          setSendSuccess(false);
                        }}
                      >
                        {ticket.status === 'IN PROGRESS' ? 'Selesai' : 'Handle'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Kanan: Panel Handle */}
        {selectedTicket ? (
          <div className="card">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-border" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '16px' }}>
              <h3 className="section-title" style={{ marginBottom: 0 }}>Panel Handle — {selectedTicket.id}</h3>
              <button className="text-muted hover:text-primary text-sm flex items-center gap-1" onClick={() => setSelectedTicket(null)}>
                <X size={14} /> tutup
              </button>
            </div>

            <div className="mb-6">
              <p className="font-bold text-primary text-lg">{selectedTicket.user} <span className="text-muted font-normal text-sm">• {selectedTicket.unit}</span></p>
              <p className="text-secondary mt-1 flex items-center gap-2">
                <MessageSquare size={14} className="text-success" /> WA: {selectedTicket.wa}
              </p>
              <p className="text-sm mt-3 p-3 bg-card-2 rounded-md border border-border text-secondary">
                <strong>Kendala:</strong> User mengajukan request lupa password dan meminta token verifikasi baru.
              </p>
            </div>

            <div className="mb-4">
              <label className="form-label text-muted">Label Hasil Tindakan</label>
              <div 
                className="flex flex-col items-center justify-center p-6 bg-input rounded-lg border border-border mb-4 text-center"
                style={{ padding: '24px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center', marginBottom: '16px' }}
              >
                <div className="text-3xl font-mono font-bold tracking-widest text-primary mb-2" style={{ letterSpacing: '4px' }}>
                  {generatedToken}
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-muted">
                  <span>Berlaku 1 jam</span>
                  <span>•</span>
                  <button className="text-brand-400 hover:text-brand-300 flex items-center gap-1" onClick={handleGenerateToken}>
                    <RefreshCw size={12} /> Regenerate
                  </button>
                </div>
              </div>

              <button 
                className="btn btn-secondary w-full mb-3" 
                onClick={handleKirimWA}
                disabled={isSending || generatedToken === 'XX - XXXXXX'}
              >
                {isSending ? 'Mengirim...' : <><Send size={16} /> Kirim via Saluran Komunikasi (WA)</>}
              </button>

              {sendSuccess && (
                <div className="p-3 bg-success/10 border border-success/30 rounded-md text-success text-sm mb-4" style={{ padding: '12px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: '6px', color: 'var(--success)', marginBottom: '16px' }}>
                  [Sukses] Token berhasil dikirim ke nomor WhatsApp {selectedTicket.wa}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border" style={{ paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-secondary text-sm">
                Tandai Selesai & Tutup
              </button>
            </div>
          </div>
        ) : (
          <div className="card flex items-center justify-center text-muted" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Pilih tiket di sebelah kiri untuk melihat detail
          </div>
        )}

      </div>
    </div>
  );
};

export default HelpdeskIT;
