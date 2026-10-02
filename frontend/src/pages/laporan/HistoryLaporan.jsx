import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

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
    fetchLaporan();
  }, [fetchLaporan]);

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

      {!isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div className="card" style={{ padding: '16px 20px' }}>
            <p className="text-muted text-sm mb-1 font-medium">{t('admin.total_laporan')}</p>
            <h3 className="text-2xl font-bold">{laporanList.length}</h3>
          </div>
          <div className="card" style={{ padding: '16px 20px' }}>
            <p className="text-muted text-sm mb-1 font-medium">{t('admin.laporan_disetujui')}</p>
            <h3 className="text-2xl font-bold">{laporanList.filter(l => l.status === 'DISETUJUI').length}</h3>
          </div>
          <div className="card" style={{ padding: '16px 20px' }}>
            <p className="text-muted text-sm mb-1 font-medium">{t('admin.perlu_revisi')}</p>
            <h3 className="text-2xl font-bold">{laporanList.filter(l => l.status === 'REVISI' || l.status === 'DITOLAK').length}</h3>
          </div>
          <div className="card" style={{ padding: '16px 20px' }}>
            <p className="text-muted text-sm mb-1 font-medium">{t('admin.menunggu_review')}</p>
            <h3 className="text-2xl font-bold">{laporanList.filter(l => l.status === 'DIAJUKAN').length}</h3>
          </div>
        </div>
      )}

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
