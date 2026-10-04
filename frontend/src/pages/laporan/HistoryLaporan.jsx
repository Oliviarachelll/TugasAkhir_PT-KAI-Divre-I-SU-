import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Activity, CheckCircle, Clock, AlertTriangle, FileText } from 'lucide-react';

import useAuthStore from '../../store/auth.store';
import useLaporanStore from '../../store/laporan.store';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDateOnly } from '../../utils/format';
import { unitApi } from '../../api/unit.api';
import { exportApi } from '../../api/export.api';
import { readBlobErrorMessage, saveBlobResponse } from '../../utils/downloadBlob';

const HistoryLaporan = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.peran === 'ADMIN_GLOBAL';
  const canFilterUnit = ['IT', 'ADMIN_GLOBAL'].includes(user?.peran);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { laporanList, fetchLaporan, isLoading, loadDraftFromLaporan } = useLaporanStore();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const [filterUnit, setFilterUnit] = useState(() => searchParams.get('unit') || 'ALL');
  const [filterStatus, setFilterStatus] = useState('ALL_STATUS');
  const [filterBulan, setFilterBulan] = useState('');
  const [units, setUnits] = useState([]);
  const [isExporting, setIsExporting] = useState(null);

  useEffect(() => {
    fetchLaporan({ limit: 500 });
  }, [fetchLaporan]);

  // Sinkronisasi jika query param unit berubah (misal dari klik chart)
  useEffect(() => {
    const urlUnit = searchParams.get('unit');
    if (urlUnit) {
      setFilterUnit(urlUnit);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!canFilterUnit) return;
    (async () => {
      try {
        const res = await unitApi.getAll({ limit: 100 });
        setUnits(res.data || []);
      } catch {
        setUnits([]);
      }
    })();
  }, [canFilterUnit]);

  // Unit yang sedang aktif dipilih
  const selectedUnit = useMemo(() => {
    if (filterUnit === 'ALL') return null;
    return units.find(u => String(u.id_unit) === String(filterUnit));
  }, [units, filterUnit]);

  // Data terfilter unit & bulan (dasar hitungan Proses Laporan)
  const unitFilteredList = useMemo(() => {
    return laporanList.filter((item) => {
      if (filterUnit !== 'ALL' && String(item.id_unit) !== String(filterUnit)) {
        return false;
      }
      if (filterBulan) {
        const itemMonth = String(item.tanggal || '').slice(0, 7);
        if (itemMonth !== filterBulan) return false;
      }
      return true;
    });
  }, [laporanList, filterUnit, filterBulan]);

  const countDisetujui = useMemo(() => unitFilteredList.filter(l => l.status === 'DISETUJUI').length, [unitFilteredList]);
  const countReview = useMemo(() => unitFilteredList.filter(l => l.status === 'DIAJUKAN').length, [unitFilteredList]);
  const countRevisi = useMemo(() => unitFilteredList.filter(l => l.status === 'REVISI' || l.status === 'DITOLAK').length, [unitFilteredList]);
  const totalStatus = countDisetujui + countReview + countRevisi || 1;

  const handleUserAction = (laporan) => {
    if (laporan.status === 'REVISI' || laporan.status === 'DRAFT') {
      loadDraftFromLaporan(laporan);
      navigate('/laporan/input');
    } else {
      navigate(`/laporan/detail/${laporan.id_laporan}`);
    }
  };

  // Compute filtered list
  const filteredList = laporanList.filter((item) => {
    // Filter Unit
    if (filterUnit !== 'ALL' && String(item.id_unit) !== String(filterUnit)) {
      return false;
    }
    // Filter Status
    if (filterStatus !== 'ALL_STATUS' && item.status !== filterStatus) {
      return false;
    }
    // Filter Bulan
    if (filterBulan) {
      const itemMonth = String(item.tanggal || '').slice(0, 7); // YYYY-MM tanpa pergeseran zona waktu
      if (itemMonth !== filterBulan) return false;
    }
    return true;
  }).sort((a, b) => {
    // Prioritaskan "DIAJUKAN" (Belum Review) agar selalu di atas
    if (a.status === 'DIAJUKAN' && b.status !== 'DIAJUKAN') return -1;
    if (a.status !== 'DIAJUKAN' && b.status === 'DIAJUKAN') return 1;
    // Jika sama, urutkan berdasarkan tanggal terbaru
    return new Date(b.tanggal) - new Date(a.tanggal);
  });

  const handleExport = async (format) => {
    const filters = {};
    if (filterUnit !== 'ALL') filters.id_unit = Number(filterUnit);
    if (filterStatus !== 'ALL_STATUS') filters.status = filterStatus;
    if (filterBulan) filters.bulan = filterBulan;

    setIsExporting(format);
    try {
      const response = await exportApi.downloadLaporan(format, filters);
      const extension = format === 'xlsx' ? 'xlsx' : 'pdf';
      saveBlobResponse(response, `KAI_Laporan.${extension}`);
      const recordCount = response.headers?.['x-export-record-count'];
      toast.success(t('export.success', { count: recordCount ?? 0 }));
    } catch (error) {
      const message = await readBlobErrorMessage(error, t('export.failed'));
      toast.error(message);
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportPDF = () => handleExport('pdf');
  const handleExportExcel = () => handleExport('xlsx');

  return (
    <div>
      
      <div className="page-header">
        <div>
          <div className="text-sm text-muted font-medium mb-1">{t('menu.laporan')} <span className="mx-1">&gt;</span> <span className="text-primary">{t('laporan.history_title')}</span></div>
        </div>
      </div>

      <div className="card mb-4" style={{ padding: '16px 24px', marginBottom: '24px' }}>
        <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div className="flex gap-3" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {canFilterUnit && (
              <select 
                className="form-control form-control-sm" 
                style={{ width: 'auto', padding: '6px 12px' }}
                value={filterUnit}
                onChange={(e) => setFilterUnit(e.target.value)}
                aria-label={t('laporan.filter_unit')}
              >
                <option value="ALL">{t('laporan.filter_unit')}</option>
                {units.map((unit) => (
                  <option key={unit.id_unit} value={unit.id_unit}>{unit.nama_unit}</option>
                ))}
              </select>
            )}
            <select 
              className="form-control form-control-sm" 
              style={{ width: 'auto', padding: '6px 12px' }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              aria-label={t('laporan.filter_status')}
            >
              <option value="ALL_STATUS">{t('laporan.filter_status')}</option>
              <option value="DRAFT">DRAFT</option>
              <option value="DIAJUKAN">DIAJUKAN</option>
              <option value="DISETUJUI">DISETUJUI</option>
              <option value="REVISI">REVISI</option>
              <option value="DITOLAK">DITOLAK</option>
            </select>
            <input 
              type="month" 
              className="form-control form-control-sm" 
              style={{ width: 'auto', padding: '6px 12px' }} 
              value={filterBulan}
              onChange={(e) => setFilterBulan(e.target.value)}
              aria-label={t('export.filter_month')}
            />
          </div>
          <div className="flex gap-2" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" disabled={Boolean(isExporting)} aria-busy={isExporting === 'xlsx'} className="btn btn-secondary btn-sm" onClick={handleExportExcel}>
              {isExporting === 'xlsx' ? t('export.processing') : t('laporan.export_excel')}
            </button>
            <button type="button" disabled={Boolean(isExporting)} aria-busy={isExporting === 'pdf'} className="btn btn-secondary btn-sm" onClick={handleExportPDF}>
              {isExporting === 'pdf' ? t('export.processing') : t('laporan.export_pdf')}
            </button>
          </div>
        </div>
      </div>

      {/* Overview & Widget Proses Laporan */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: '20px', marginBottom: '24px', alignItems: 'stretch' }}>
        {/* Card: Proses Laporan */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h3 className="font-bold text-base m-0 text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} style={{ color: 'var(--kai-orange)' }} />
              <span>{t('laporan.proses_laporan', 'Proses Laporan')}</span>
              {selectedUnit && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--brand-50)', color: 'var(--brand-500)' }}>
                  {selectedUnit.nama_unit}
                </span>
              )}
            </h3>
            {filterStatus !== 'ALL_STATUS' && (
              <button 
                onClick={() => setFilterStatus('ALL_STATUS')}
                className="text-xs text-blue-500 hover:underline"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Reset Filter
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Disetujui */}
            <div 
              onClick={() => setFilterStatus(filterStatus === 'DISETUJUI' ? 'ALL_STATUS' : 'DISETUJUI')}
              style={{ 
                cursor: 'pointer', 
                padding: '6px 8px', 
                borderRadius: '8px', 
                transition: 'all 0.2s', 
                backgroundColor: filterStatus === 'DISETUJUI' ? 'var(--surface-soft)' : 'transparent',
                outline: filterStatus === 'DISETUJUI' ? '1px solid var(--success-border)' : 'none'
              }}
              title={t('dashboard.filter_approved')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span className="text-sm font-bold text-gray-700">{t('dashboard.disetujui')}</span>
                <span className="text-sm font-bold text-[var(--success)]">{t('dashboard.report_count', { count: countDisetujui })}</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--surface-soft)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${(countDisetujui / totalStatus) * 100}%`, height: '100%', backgroundColor: 'var(--success)', borderRadius: '4px' }}></div>
              </div>
            </div>

            {/* Perlu review */}
            <div 
              onClick={() => setFilterStatus(filterStatus === 'DIAJUKAN' ? 'ALL_STATUS' : 'DIAJUKAN')}
              style={{ 
                cursor: 'pointer', 
                padding: '6px 8px', 
                borderRadius: '8px', 
                transition: 'all 0.2s', 
                backgroundColor: filterStatus === 'DIAJUKAN' ? 'var(--surface-soft)' : 'transparent',
                outline: filterStatus === 'DIAJUKAN' ? '1px solid var(--warning-border)' : 'none'
              }}
              title={t('dashboard.filter_review')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span className="text-sm font-bold text-gray-700">{t('dashboard.need_review')}</span>
                <span className="text-sm font-bold text-[var(--warning)]">{t('dashboard.report_count', { count: countReview })}</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--surface-soft)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${(countReview / totalStatus) * 100}%`, height: '100%', backgroundColor: 'var(--warning)', borderRadius: '4px' }}></div>
              </div>
            </div>

            {/* Perlu revisi */}
            <div 
              onClick={() => setFilterStatus(filterStatus === 'REVISI' ? 'ALL_STATUS' : 'REVISI')}
              style={{ 
                cursor: 'pointer', 
                padding: '6px 8px', 
                borderRadius: '8px', 
                transition: 'all 0.2s', 
                backgroundColor: filterStatus === 'REVISI' ? 'var(--surface-soft)' : 'transparent',
                outline: filterStatus === 'REVISI' ? '1px solid var(--danger-border)' : 'none'
              }}
              title={t('dashboard.filter_revision')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span className="text-sm font-bold text-gray-700">{t('dashboard.need_revision')}</span>
                <span className="text-sm font-bold text-[var(--danger)]">{t('dashboard.report_count', { count: countRevisi })}</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--surface-soft)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${(countRevisi / totalStatus) * 100}%`, height: '100%', backgroundColor: 'var(--danger)', borderRadius: '4px' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          <div className="card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--brand-50)', display: 'grid', placeItems: 'center', color: 'var(--brand-500)' }}>
                <FileText size={18} />
              </div>
              <p className="text-muted text-sm m-0 font-medium">{t('admin.total_laporan')}</p>
            </div>
            <h3 className="text-3xl font-bold text-primary m-0 mt-1">{unitFilteredList.length}</h3>
          </div>
          <div className="card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--success-bg)', display: 'grid', placeItems: 'center', color: 'var(--success)' }}>
                <CheckCircle size={18} />
              </div>
              <p className="text-muted text-sm m-0 font-medium">{t('admin.laporan_disetujui')}</p>
            </div>
            <h3 className="text-3xl font-bold text-[var(--success)] m-0 mt-1">{countDisetujui}</h3>
          </div>
          <div className="card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--warning-bg)', display: 'grid', placeItems: 'center', color: 'var(--warning)' }}>
                <Clock size={18} />
              </div>
              <p className="text-muted text-sm m-0 font-medium">{t('admin.menunggu_review')}</p>
            </div>
            <h3 className="text-3xl font-bold text-[var(--warning)] m-0 mt-1">{countReview}</h3>
          </div>
          <div className="card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--danger-bg)', display: 'grid', placeItems: 'center', color: 'var(--danger)' }}>
                <AlertTriangle size={18} />
              </div>
              <p className="text-muted text-sm m-0 font-medium">{t('admin.perlu_revisi')}</p>
            </div>
            <h3 className="text-3xl font-bold text-[var(--danger)] m-0 mt-1">{countRevisi}</h3>
          </div>
        </div>
      </div>

      <div className="card p-0" style={{ padding: 0 }}>
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>{t('laporan.th_date')}</th>
                {isAdmin && <th>{t('laporan.th_unit')}</th>}
                <th>{t('laporan.th_type')}</th>
                {isAdmin && <th>{t('laporan.th_submitter')}</th>}
                <th>{t('laporan.th_status')}</th>
                {!isAdmin && <th>{t('laporan.th_notes')}</th>}
                {isAdmin && <th>{t('laporan.th_reviewer')}</th>}
                <th>{t('laporan.th_action')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="text-center p-4">{t('laporan.loading')}</td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="text-center p-4 text-muted">{t('laporan.empty_filter')}</td>
                </tr>
              ) : (
                filteredList.map((laporan) => {
                  const tgl = formatDateOnly(laporan.tanggal, { day: '2-digit', month: 'short', year: 'numeric' }, lang);
                  let badgeClass = 'badge-diajukan';
                  if (laporan.status === 'DISETUJUI') badgeClass = 'badge-disetujui';
                  if (laporan.status === 'DITOLAK' || laporan.status === 'REVISI') badgeClass = 'badge-revisi';

                  return (
                    <tr key={laporan.id_laporan}>
                      <td>{tgl}</td>
                      {isAdmin && <td>{laporan.unit?.nama_unit || '-'}</td>}
                      <td>{t('dashboard.daily_data')}</td>
                      {isAdmin && <td>{laporan.pengguna?.nama || '-'}</td>}
                      <td><span className={`badge ${badgeClass}`}>{laporan.status}</span></td>
                      {!isAdmin && <td className="text-muted">{laporan.kotak_detail || '—'}</td>}
                      {isAdmin && <td>—</td>}
                      <td>
                        <button 
                          className={isAdmin ? (laporan.status === 'DIAJUKAN' ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm") : ((laporan.status === 'REVISI' || laporan.status === 'DRAFT') ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm")}
                          onClick={() => {
                            if (isAdmin) {
                              navigate(`/laporan/review/${laporan.id_laporan}`);
                            } else {
                              handleUserAction(laporan);
                            }
                          }}
                        >
                          {isAdmin ? (laporan.status === 'DIAJUKAN' ? t('laporan.review_action') : t('laporan.view')) : ((laporan.status === 'REVISI' || laporan.status === 'DRAFT') ? t('laporan.edit') : t('laporan.view'))}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HistoryLaporan;
