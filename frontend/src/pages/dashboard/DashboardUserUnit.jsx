import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import useLaporanStore from '../../store/laporan.store';
import useAuthStore from '../../store/auth.store';
import { useTranslation } from 'react-i18next';

import DashboardKNA from './components/DashboardKNA';
import DashboardBarang from './components/DashboardBarang';
import DashboardPenumpang from './components/DashboardPenumpang';
import DashboardKeuangan from './components/DashboardKeuangan';

const DashboardUserUnit = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { laporanList, fetchLaporan, isLoading } = useLaporanStore();
  const { t } = useTranslation();

  useEffect(() => {
    fetchLaporan({ limit: 50 });
  }, [fetchLaporan]);

  // Identifikasi unit pengguna
  const unitName = user?.unit?.nama_unit || '';
  const isKNA = unitName.toLowerCase().includes('kna');
  const isBarang = unitName.toLowerCase().includes('barang');
  const isPenumpang = unitName.toLowerCase().includes('penumpang');
  const isKeuangan = unitName.toLowerCase().includes('keuang');

  // Filter laporan yang sudah disetujui untuk kalkulasi
  const approvedLaporan = useMemo(() => {
    return laporanList.filter(l => l.status === 'DISETUJUI');
  }, [laporanList]);

  const [countdownText, setCountdownText] = React.useState('');
  const [historyFilter, setHistoryFilter] = React.useState('Semua');

  const countDisetujui = useMemo(() => laporanList.filter(l => l.status === 'DISETUJUI').length, [laporanList]);
  const countReview = useMemo(() => laporanList.filter(l => l.status === 'DIAJUKAN').length, [laporanList]);
  const countRevisi = useMemo(() => laporanList.filter(l => l.status === 'REVISI').length, [laporanList]);
  const totalStatus = countDisetujui + countReview + countRevisi || 1;

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      let target = new Date();
      target.setHours(17, 0, 0, 0);

      if (now > target) {
        target.setDate(target.getDate() + 1);
      }

      const diff = target - now;
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdownText(`${h} jam ${m} menit ${s} detik`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div style={{ backgroundColor: 'var(--bg-card-2)', border: '1px solid var(--border)', padding: '16px 20px', borderRadius: '12px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, color: 'var(--brand-500)', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} /> 
          {t('dashboard.reminder')} {countdownText}
        </p>
        <button className="btn btn-sm" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--brand-500)', border: '1px solid var(--border)', fontWeight: '500', borderRadius: '8px' }} onClick={() => navigate('/laporan/input')}>{t('dashboard.input_btn')}</button>
      </div>

      {isLoading ? (
        <div className="text-center py-10">Memuat data dashboard...</div>
      ) : (
        <>
          {/* Dashboard Komponen Unit Spesifik */}
          {isKNA && <DashboardKNA laporanList={laporanList} approvedLaporan={approvedLaporan} />}
          {isBarang && <DashboardBarang approvedLaporan={approvedLaporan} />}
          {isPenumpang && <DashboardPenumpang approvedLaporan={approvedLaporan} />}
          {isKeuangan && <DashboardKeuangan laporanList={laporanList} approvedLaporan={approvedLaporan} />}

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
            {/* Kiri: History Laporan */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                  <h3 className="font-bold text-lg m-0 text-gray-800">{t('dashboard.history_laporan')}</h3>
                  <p className="text-sm text-gray-500 m-0 mt-1">Tabel diperjelas dengan hierarki kolom yang lebih rapi.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['Semua', 'Disetujui', 'Review', 'Revisi'].map(filter => {
                    const label = filter === 'Semua' ? t('dashboard.filter_all') : 
                                  filter === 'Disetujui' ? t('dashboard.filter_approved') : 
                                  filter === 'Review' ? t('dashboard.filter_review') : 
                                  t('dashboard.filter_revision');
                    return (
                    <button 
                      key={filter}
                      onClick={() => setHistoryFilter(filter)}
                      style={{
                        padding: '6px 16px',
                        borderRadius: '20px',
                        fontSize: '13px',
                        fontWeight: '600',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: historyFilter === filter ? 'var(--brand-50)' : 'transparent',
                        color: historyFilter === filter ? 'var(--brand-500)' : 'var(--text-muted)',
                        transition: 'all 0.2s'
                      }}
                    >
                      {label}
                    </button>
                  )})}
                </div>
              </div>

              {/* Table Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr 2fr 1fr', alignItems: 'center', padding: '12px 16px', backgroundColor: 'var(--surface-soft)', borderRadius: '12px', marginBottom: '12px', border: '1px solid var(--border)' }}>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('dashboard.table_date')}</span>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('dashboard.table_type')}</span>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('dashboard.table_status')}</span>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('dashboard.table_desc')}</span>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">{t('dashboard.table_action')}</span>
              </div>

              {/* Table Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {laporanList.length === 0 ? (
                  <div className="text-center py-8 text-muted border border-dashed rounded-lg">Belum ada history laporan.</div>
                ) : (
                  [...laporanList]
                    .filter(row => {
                      if (historyFilter === 'Disetujui') return row.status === 'DISETUJUI';
                      if (historyFilter === 'Review') return row.status === 'DIAJUKAN' || row.status === 'REVISI';
                      return true;
                    })
                    .sort((a, b) => {
                      const order = { 'REVISI': 1, 'DIAJUKAN': 2, 'DISETUJUI': 3 };
                      const orderA = order[a.status] || 99;
                      const orderB = order[b.status] || 99;
                      if (orderA !== orderB) return orderA - orderB;
                      return new Date(b.tanggal) - new Date(a.tanggal);
                    }).map(row => (
                    <div key={row.id_laporan} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr 2fr 1fr', alignItems: 'center', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <span className="text-sm font-medium text-gray-800">{new Date(row.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      <span className="text-sm text-gray-600">Data {isKNA ? 'KNA' : isBarang ? 'Barang' : 'Penumpang'}</span>
                      <div>
                        <span className={`badge ${row.status === 'DISETUJUI' ? 'badge-disetujui' : row.status === 'REVISI' ? 'badge-revisi' : 'badge-diajukan'}`}>
                          {row.status}
                        </span>
                      </div>
                      <span className="text-sm text-gray-600 pr-4 truncate">
                        {row.kotak_detail || (row.status === 'DISETUJUI' ? 'Laporan divalidasi dan disetujui.' : 'Menunggu review pihak terkait.')}
                      </span>
                      <div className="text-center">
                        <button 
                          onClick={() => navigate('/laporan/history')}
                          style={{ padding: '6px 16px', borderRadius: '8px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border)', fontSize: '13px', fontWeight: '500', color: 'var(--text-main)', cursor: 'pointer' }}
                        >
                          Lihat detail
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Kanan: Sidebar Komposisi & Progress */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Card Progress Pengisian */}
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ marginBottom: '24px' }}>
                  <h3 className="font-bold text-base m-0 text-gray-800">Progress Pengisian</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Disetujui */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span className="text-sm font-bold text-gray-700">Disetujui</span>
                      <span className="text-sm font-bold text-[var(--success)]">{countDisetujui} laporan</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--surface-soft)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${(countDisetujui / totalStatus) * 100}%`, height: '100%', backgroundColor: 'var(--success)', borderRadius: '4px' }}></div>
                    </div>
                  </div>

                  {/* Perlu review */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span className="text-sm font-bold text-gray-700">Perlu review</span>
                      <span className="text-sm font-bold text-[var(--warning)]">{countReview} laporan</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--surface-soft)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${(countReview / totalStatus) * 100}%`, height: '100%', backgroundColor: 'var(--warning)', borderRadius: '4px' }}></div>
                    </div>
                  </div>

                  {/* Perlu revisi */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span className="text-sm font-bold text-gray-700">Perlu revisi</span>
                      <span className="text-sm font-bold text-[var(--danger)]">{countRevisi} laporan</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--surface-soft)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${(countRevisi / totalStatus) * 100}%`, height: '100%', backgroundColor: 'var(--danger)', borderRadius: '4px' }}></div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardUserUnit;
