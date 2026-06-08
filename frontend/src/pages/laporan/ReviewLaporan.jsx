import React, { useState } from 'react';
import { Check, X, ArrowLeft, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ReviewLaporan = () => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState(''); // 'acc' or 'revisi'
  const [catatan, setCatatan] = useState('');

  const handleAction = (action) => {
    setModalAction(action);
    setShowModal(true);
  };

  return (
    <div>
      <div className="mb-4">
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard/admin')}>
          <ArrowLeft size={16} /> Kembali
        </button>
      </div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Review Laporan</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* Kiri: Data Read Only */}
        <div>
          <div className="card mb-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold">Unit DAOP 1</h3>
                <p className="text-muted text-sm mt-1">Data Harian • 08 Jun 2026</p>
              </div>
              <span className="badge badge-diajukan">MENUNGGU REVIEW</span>
            </div>
          </div>

          <div className="card mb-4">
            <h3 className="section-title">Data Harian</h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Kolom A</th>
                    <th>Kolom B (Satuan)</th>
                    <th>Kolom C (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3].map(i => (
                    <tr key={i}>
                      <td>Item {i}</td>
                      <td>1,23{i}</td>
                      <td>12.{i}0</td>
                      <td>Rp 1.{i}00.000</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">Target vs Realisasi</h3>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted">Target: 1,000 Satuan</span>
              <span className="text-muted">Realisasi: 850 Satuan</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-2xl font-bold text-primary">85%</div>
              <div style={{ flex: 1, height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: '85%', height: '100%', background: 'var(--brand-500)' }}></div>
              </div>
            </div>
            <div className="divider"></div>
            <div>
              <p className="text-sm font-bold mb-1">Catatan Detail (opsional dari Unit):</p>
              <p className="text-sm text-secondary">Terjadi penurunan pada shift sore karena cuaca buruk.</p>
            </div>
          </div>
        </div>

        {/* Kanan: Panel Tindakan */}
        <div>
          <div className="card sticky top-24" style={{ position: 'sticky', top: '90px' }}>
            <h3 className="section-title">Tindakan Review</h3>
            <p className="text-xs text-muted mb-4">Reviewer: Anda • {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</p>
            
            <button 
              className="btn w-full mb-6" 
              style={{ background: 'rgba(52,211,153,0.15)', color: 'var(--success)', border: '1px solid rgba(52,211,153,0.3)', justifyContent: 'flex-start' }}
              onClick={() => handleAction('acc')}
            >
              <Check size={18} /> ACC — Terima Laporan
            </button>

            <div className="relative text-center mb-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" style={{ width: '100%', borderTop: '1px solid var(--border)' }}></div></div>
              <span className="relative bg-card px-2 text-xs text-muted" style={{ background: 'var(--bg-card)', padding: '0 8px', position: 'relative' }}>atau</span>
            </div>

            <div className="form-group">
              <label className="form-label">Catatan Revisi (wajib jika REVISI)</label>
              <textarea 
                className="form-control" 
                rows="4" 
                placeholder="Masukkan catatan spesifik apa yang perlu diperbaiki..."
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
              ></textarea>
            </div>

            <button 
              className="btn w-full mb-4" 
              style={{ background: 'rgba(251,113,133,0.15)', color: 'var(--danger)', border: '1px solid rgba(251,113,133,0.3)', justifyContent: 'flex-start' }}
              onClick={() => handleAction('revisi')}
              disabled={!catatan.trim()}
            >
              <X size={18} /> REVISI — Kembalikan Laporan
            </button>
            
            <p className="text-xs text-muted text-center flex items-center justify-center gap-1">
              <Send size={12} /> Notifikasi WA akan dikirim otomatis ke unit
            </p>
          </div>
        </div>
      </div>

      {/* Modal Konfirmasi */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Konfirmasi Tindakan</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            
            <div className="mb-4">
              <p className="text-secondary">
                {modalAction === 'acc' 
                  ? 'Anda yakin ingin menyetujui (ACC) laporan ini? Laporan yang sudah disetujui tidak dapat diubah oleh unit.' 
                  : 'Anda yakin ingin mengembalikan laporan ini untuk direvisi? Pastikan catatan revisi sudah jelas.'}
              </p>
              {modalAction === 'revisi' && (
                <div className="mt-3 p-3 bg-card-2 border border-border rounded-md text-sm text-primary">
                  <strong>Catatan:</strong> {catatan}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
              <button 
                className={`btn ${modalAction === 'acc' ? 'btn-primary' : 'btn-danger'}`}
                onClick={() => {
                  setShowModal(false);
                  navigate('/dashboard/admin');
                }}
              >
                Konfirmasi {modalAction === 'acc' ? 'ACC' : 'Revisi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewLaporan;
