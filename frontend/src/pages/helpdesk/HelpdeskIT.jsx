import React, { useState } from 'react';
import { Send, RefreshCw, X, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

const dummyTickets = [
  { id: 'TKT-001', user: 'Nama User 1', unit: 'Nama Unit', waktu: 'DD MMM HH:MM', wa: '+62XXX-XXXX-XXXX', status: 'IN PROGRESS', type: 'TIPE A' },
  { id: 'TKT-002', user: 'Nama User 2', unit: 'Nama Unit', waktu: 'DD MMM HH:MM', wa: '+62XXX-XXXX-XXXX', status: 'OPEN', type: 'TIPE B' },
  { id: 'TKT-003', user: 'Nama User 3', unit: 'Nama Unit', waktu: 'DD MMM HH:MM', wa: '+62XXX-XXXX-XXXX', status: 'OPEN', type: 'TIPE A' },
];

const HelpdeskIT = () => {
  const [activeTab, setActiveTab] = useState('TIPE A (0)');
  const [selectedTicket, setSelectedTicket] = useState(null);
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
  };

  const handleKirimWA = () => {
    if (generatedToken === 'XX - XXXXXX') {
      return;
    }
    
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setSendSuccess(true);
    }, 1500);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="text-sm text-muted font-medium mb-1">Helpdesk <span className="mx-1">&gt;</span> <span className="text-primary">Manajemen Helpdesk</span></div>
        </div>
      </div>

      <div className="tabs mb-4" style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        {['TIPE A (0)', 'TIPE B (0)', 'Semua'].map(tab => (
          <button 
            key={tab}
            className={`tab-item ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
            style={{ 
              padding: '12px 4px', 
              background: 'transparent', 
              border: 'none', 
              color: activeTab === tab ? '#1e293b' : '#94a3b8',
              borderBottom: activeTab === tab ? '2px solid #1e293b' : '2px solid transparent',
              fontWeight: activeTab === tab ? 600 : 500,
              cursor: 'pointer'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedTicket ? '1fr 1fr' : '1fr', gap: '24px' }}>
        
        {/* Kiri: Daftar Tiket */}
        <div>
          <div className="card p-0" style={{ padding: 0 }}>
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>ID TIKET</th>
                    <th>NAMA USER</th>
                    {!selectedTicket && <th>UNIT</th>}
                    {!selectedTicket && <th>WAKTU</th>}
                    <th>STATUS</th>
                    <th>AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {dummyTickets.map(ticket => (
                    <tr key={ticket.id} style={{ background: selectedTicket?.id === ticket.id ? '#f8fafc' : 'transparent' }}>
                      <td>{ticket.id}</td>
                      <td>{ticket.user}</td>
                      {!selectedTicket && <td>{ticket.unit}</td>}
                      {!selectedTicket && <td>{ticket.waktu}</td>}
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 10px',
                          borderRadius: '16px',
                          border: '1px solid #94a3b8',
                          fontSize: '12px',
                          color: '#475569',
                          backgroundColor: 'transparent'
                        }}>
                          {ticket.status}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="btn btn-secondary btn-sm"
                          style={{ backgroundColor: '#cbd5e1', color: '#1e293b', border: '1px solid #94a3b8' }}
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
          
          {!selectedTicket && (
            <div style={{ padding: '16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#475569', fontSize: '14px', marginTop: '16px' }}>
              ↑ Klik tombol <strong>Handle</strong> pada baris tiket untuk membuka panel penanganan →
            </div>
          )}
        </div>

        {/* Kanan: Panel Handle */}
        {selectedTicket && (
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #cbd5e1', paddingBottom: '16px', marginBottom: '16px' }}>
              <h3 className="font-bold text-lg m-0">Panel Handle — {selectedTicket.id}</h3>
              <button className="text-muted hover:text-primary text-sm flex items-center gap-1" onClick={() => setSelectedTicket(null)}>
                [× tutup]
              </button>
            </div>

            <div className="mb-6">
              <p className="font-bold text-gray-900 text-base mb-1">{selectedTicket.user} <span className="font-normal text-gray-500 text-sm">· {selectedTicket.unit}</span></p>
              <p className="text-gray-700 text-sm mb-4">
                WA: {selectedTicket.wa}
              </p>
              
              <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '16px', marginTop: '16px' }}>
                <label className="text-sm text-gray-500 mb-2 block">Label Hasil Tindakan</label>
                
                <div 
                  style={{ padding: '32px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', marginBottom: '16px' }}
                >
                  <div className="text-3xl font-mono font-bold tracking-widest text-gray-900 mb-2" style={{ letterSpacing: '4px' }}>
                    {generatedToken}
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                    <span>Berlaku X jam</span>
                    <span>·</span>
                    <button className="text-gray-500 hover:text-gray-900 flex items-center gap-1" onClick={handleGenerateToken}>
                      [↻ Regenerate]
                    </button>
                  </div>
                </div>

                <button 
                  className="btn btn-secondary text-sm px-4 py-2 w-auto mb-4" 
                  style={{ backgroundColor: '#cbd5e1', color: '#1e293b', border: '1px solid #94a3b8' }}
                  onClick={handleKirimWA}
                  disabled={isSending || generatedToken === 'XX - XXXXXX'}
                >
                  {isSending ? 'Mengirim...' : 'Kirim via Saluran Komunikasi'}
                </button>

                {sendSuccess && (
                  <div style={{ padding: '12px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#1e293b', fontSize: '14px', marginBottom: '16px' }}>
                    [Sukses] Lorem ipsum pesan sukses pengiriman.
                  </div>
                )}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '16px' }}>
              <button className="btn btn-secondary text-sm px-4 py-2" style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} onClick={() => setSelectedTicket(null)}>
                Tandai Selesai & Tutup
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default HelpdeskIT;
