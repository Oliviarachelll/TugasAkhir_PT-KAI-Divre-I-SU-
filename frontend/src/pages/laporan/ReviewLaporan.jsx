import React, { useState, useEffect } from 'react';
import { Check, X, ArrowLeft, Send } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import useLaporanStore from '../../store/laporan.store';
import useAuthStore from '../../store/auth.store';
import ReviewKNA from './components/ReviewKNA';
import ReviewPenumpang from './components/ReviewPenumpang';
import ReviewBarang from './components/ReviewBarang';
import ReviewKeuangan from './components/ReviewKeuangan';

const ReviewLaporan = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { fetchLaporanById, laporanDetail, updateStatusLaporan, unlockLaporan, isLoading } = useLaporanStore();
  const { user } = useAuthStore();
  const isAdmin = user?.peran === 'ADMIN_GLOBAL';

  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState(''); // 'acc' or 'revisi'
  const [catatan, setCatatan] = useState('');
  
  // Token state
  const [tokenInput, setTokenInput] = useState('');
  const [showTokenModal, setShowTokenModal] = useState(false);

  useEffect(() => {
    if (id) {
      fetchLaporanById(id);
    }
  }, [id, fetchLaporanById]);

  const handleAction = (action) => {
    setModalAction(action);
    setShowModal(true);
  };

  const submitAction = async () => {
    const status = modalAction === 'acc' ? 'DISETUJUI' : 'REVISI';
    const success = await updateStatusLaporan(id, status, catatan);
    if (success) {
      setShowModal(false);
      navigate('/dashboard/admin');
    }
  };

  const submitToken = async () => {
    if (!tokenInput.trim()) return;
    const success = await unlockLaporan(id, tokenInput);
    if (success) {
      setShowTokenModal(false);
      setTokenInput('');
      fetchLaporanById(id); // Refresh to see REVISI status
    }
  };

  if (isLoading && !laporanDetail) {
    return <div className="p-8 text-center text-muted">Memuat data laporan...</div>;
  }

  if (!laporanDetail) {
    return <div className="p-8 text-center text-danger">Laporan tidak ditemukan.</div>;
  }

  const showRightPanel = (isAdmin && laporanDetail.status === 'DIAJUKAN') || (!isAdmin && laporanDetail.status === 'DISETUJUI');

  return (
    <div>
      
      <div className="page-header">
        <div>
          <button className="btn btn-secondary btn-sm mb-4" onClick={() => navigate(isAdmin ? '/dashboard/admin' : '/laporan/history')}><ArrowLeft size={16} /> Kembali</button>
          <div className="text-sm text-muted font-medium mb-1">Laporan <span className="mx-1">&gt;</span> <span className="text-primary">Detail Laporan</span></div>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${showRightPanel ? 'lg:grid-cols-3' : ''} gap-6`} style={{ display: 'grid', gridTemplateColumns: showRightPanel ? '2fr 1fr' : '1fr', gap: '24px' }}>
        
        {/* Kiri: Data Read Only */}
        <div>
          <div className="card mb-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold">{laporanDetail.unit?.nama_unit || `Unit ID: ${laporanDetail.id_unit}`}</h3>
                <p className="text-muted text-sm mt-1">LPR-{laporanDetail.id_laporan} • {new Date(laporanDetail.tanggal).toLocaleDateString('id-ID')}</p>
                <p className="text-muted text-sm">Pelapor: {laporanDetail.pengguna?.nama}</p>
              </div>
              <span className={`badge ${laporanDetail.status === 'DISETUJUI' ? 'badge-disetujui' : laporanDetail.status === 'DITOLAK' ? 'badge-ditolak' : 'badge-diajukan'}`}>
                {laporanDetail.status}
              </span>
            </div>
          </div>

          {laporanDetail.unit?.nama_unit === 'Unit KNA' && laporanDetail.laporan_kna && (
            <ReviewKNA laporan_kna={laporanDetail.laporan_kna} />
          )}

          {laporanDetail.unit?.nama_unit === 'Unit Angkutan Penumpang' && laporanDetail.laporan_penumpang && laporanDetail.laporan_penumpang.length > 0 && (
            <ReviewPenumpang laporan_penumpang={laporanDetail.laporan_penumpang} />
          )}

          {laporanDetail.unit?.nama_unit === 'Unit Angkutan Barang' && laporanDetail.laporan_barang && laporanDetail.laporan_barang.length > 0 && (
            <ReviewBarang laporan_barang={laporanDetail.laporan_barang} />
          )}

          {laporanDetail.unit?.nama_unit === 'Unit Keuangan' && laporanDetail.laporan_keuangan && (
            <ReviewKeuangan laporan_keuangan={laporanDetail.laporan_keuangan} />
          )}

          <div className="card">
            <h3 className="section-title">Informasi Proses & Catatan</h3>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted">Status Proses Internal: {laporanDetail.status_internal}</span>
            </div>
            <div className="divider"></div>
            <div>
              <p className="text-sm font-bold mb-1">Catatan Detail / Kotak Detail (opsional dari Unit):</p>
              <p className="text-sm text-secondary">{laporanDetail.kotak_detail || '—'}</p>
            </div>
          </div>
        </div>

        {/* Kanan: Panel Tindakan */}
        {isAdmin && laporanDetail.status === 'DIAJUKAN' && (
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
        )}

        {!isAdmin && laporanDetail.status === 'DISETUJUI' && (
        <div>
          <div className="card sticky top-24" style={{ position: 'sticky', top: '90px' }}>
            <h3 className="section-title">Revisi Terkunci</h3>
            <p className="text-sm text-muted mb-4">
              Laporan ini telah di-ACC. Jika Anda butuh merevisi, silakan masukkan <strong>Token Akses</strong> dari Helpdesk (Admin Global/IT).
            </p>
            
            <button 
              className="btn btn-primary w-full" 
              onClick={() => setShowTokenModal(true)}
            >
              Masukkan Token Revisi
            </button>
          </div>
        </div>
        )}
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
                onClick={submitAction}
                disabled={isLoading}
              >
                {isLoading ? 'Memproses...' : `Konfirmasi ${modalAction === 'acc' ? 'ACC' : 'Revisi'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Token Revisi */}
      {showTokenModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Masukkan Token Revisi</h3>
              <button className="modal-close" onClick={() => setShowTokenModal(false)}><X size={18} /></button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-secondary mb-3">
                Silakan masukkan token akses yang diberikan oleh Helpdesk untuk membuka kembali laporan ini agar dapat direvisi.
              </p>
              <input 
                type="text" 
                className="form-control font-mono text-center tracking-widest text-lg" 
                placeholder="XX - XXXXXX"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                autoFocus
              />
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowTokenModal(false)}>Batal</button>
              <button 
                className="btn btn-primary"
                onClick={submitToken}
                disabled={isLoading || !tokenInput.trim()}
              >
                {isLoading ? 'Memproses...' : 'Unlock Laporan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewLaporan;
