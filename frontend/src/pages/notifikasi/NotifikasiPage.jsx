import React, { useState } from 'react';
import { Send, CheckCircle2, History } from 'lucide-react';

const NotifikasiPage = () => {
  const [pesan, setPesan] = useState('');

  return (
    <div className="flex flex-col gap-6" style={{ padding: '0' }}>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
        <div className="card">
          <h3 className="section-title">Kirim Broadcast Baru</h3>
          
          <div className="form-group">
            <label className="form-label">Pilih Penerima</label>
            <div className="flex gap-4 mb-2" style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
              <label className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" name="penerima" defaultChecked /> Semua Unit
              </label>
              <label className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" name="penerima" /> Unit Tertentu
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Tujuan Notifikasi</label>
            <select className="form-control">
              <option>Peringatan Deadline Laporan</option>
              <option>Informasi Maintenance Sistem</option>
              <option>Pengumuman Penting</option>
              <option>Lainnya</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Isi Pesan WhatsApp</label>
            <textarea 
              className="form-control" 
              rows="6" 
              placeholder="Tuliskan pesan yang akan dikirim via WhatsApp..."
              value={pesan}
              onChange={(e) => setPesan(e.target.value)}
            ></textarea>
            <p className="text-xs text-muted mt-2 flex justify-between">
              <span>*Mendukung format bold (*teks*), italic (_teks_)</span>
              <span>{pesan.length}/1000 karakter</span>
            </p>
          </div>

          <div className="pt-4 border-t border-border mt-4" style={{ paddingTop: '16px', borderTop: '1px solid var(--border)', marginTop: '16px' }}>
            <button className="btn btn-primary w-full justify-center" disabled={!pesan.trim()}>
              <Send size={18} className="mr-2" /> Kirim Broadcast Sekarang
            </button>
          </div>
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="section-title" style={{ marginBottom: 0 }}>Riwayat Broadcast</h3>
            <span className="badge" style={{ background: 'var(--bg-card-2)' }}><History size={14} className="mr-1" /> 30 Hari Terakhir</span>
          </div>

          <div className="space-y-4" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 rounded-lg bg-card-2 border border-border" style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-card-2)', border: '1px solid var(--border)' }}>
                <div className="flex justify-between items-start mb-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span className="text-sm font-bold text-primary">Peringatan Deadline</span>
                  <span className="text-xs text-muted">0{i} Jun 2026, 15:00</span>
                </div>
                <p className="text-sm text-secondary line-clamp-2 mb-3">
                  Yth. Admin Unit, Mengingatkan kembali untuk batas waktu pelaporan data harian adalah pukul 17.00 WIB. Terima kasih.
                </p>
                <div className="flex items-center gap-2 text-xs text-success" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)' }}>
                  <CheckCircle2 size={14} /> Terkirim ke 4 Unit
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotifikasiPage;
