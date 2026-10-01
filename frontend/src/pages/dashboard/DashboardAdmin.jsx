import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { FileText, CheckCircle, Clock, AlertTriangle, Download, LayoutDashboard, Truck, Users, Activity, Building2, FileSpreadsheet } from 'lucide-react';
import StatCard from '../../components/ui/StatCard';
import useLaporanStore from '../../store/laporan.store';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

import DashboardKNA from './components/DashboardKNA';
import DashboardBarang from './components/DashboardBarang';
import DashboardPenumpang from './components/DashboardPenumpang';
import DashboardKeuangan from './components/DashboardKeuangan';
import { formatDateOnly } from '../../utils/format';
import { targetApi } from '../../api/target.api';
import { unitApi } from '../../api/unit.api';
import { exportApi } from '../../api/export.api';
import { readBlobErrorMessage, saveBlobResponse } from '../../utils/downloadBlob';

const DashboardAdmin = () => {
  const navigate = useNavigate();
  const { laporanList, fetchLaporan, isLoading } = useLaporanStore();
  const { t, i18n } = useTranslation();
  
  const [activeTab, setActiveTab] = useState('global');
  const [filterUnit, setFilterUnit] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL_STATUS');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [units, setUnits] = useState([]);
  const [isExporting, setIsExporting] = useState(null);
  // Target tahunan master per kategori (denominator % dashboard).
  const [masterTargets, setMasterTargets] = useState([]);

  useEffect(() => {
    fetchLaporan({ limit: 500 }); // Ambil lebih banyak untuk dashboard admin global
  }, [fetchLaporan]);

  useEffect(() => {
    (async () => {
      try {
        const res = await targetApi.getAll({ tahun: new Date().getFullYear() });
        setMasterTargets(res.data || []);
      } catch {
        setMasterTargets([]);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await unitApi.getAll({ limit: 100 });
        setUnits(res.data || []);
      } catch {
        setUnits([]);
      }
    })();
  }, []);

  const sumTargetKategori = (kategori) => {
    const rows = masterTargets.filter((item) => item.kategori === kategori);
    if (rows.length === 0) return null;
    return rows.reduce((sum, item) => sum + (Number(item.nilai) || 0), 0);
  };

  const filteredLaporan = useMemo(() => {
    return laporanList;
  }, [laporanList]);

  const approvedLaporan = useMemo(() => {
    return filteredLaporan.filter(l => l.status === 'DISETUJUI');
  }, [filteredLaporan]);



  // Hitung Metrik Global
  const totalLaporan = filteredLaporan.length;
  const menungguReview = filteredLaporan.filter(l => l.status === 'DIAJUKAN').length;
  const disetujui = filteredLaporan.filter(l => l.status === 'DISETUJUI').length;
  const revisi = filteredLaporan.filter(l => l.status === 'REVISI' || l.status === 'DITOLAK').length;

  // Chart Data: Laporan per Unit
  const chartData = useMemo(() => {
    const unitMap = {};
    filteredLaporan.forEach(l => {
      const namaUnit = l.unit?.nama_unit || `Unit ID: ${l.id_unit}`;
      if (!unitMap[namaUnit]) unitMap[namaUnit] = { value: 0, id_unit: l.id_unit };
      unitMap[namaUnit].value++;
      // simpan id_unit terakhir yang valid
      if (l.id_unit) unitMap[namaUnit].id_unit = l.id_unit;
    });
    
    return Object.entries(unitMap)
      .map(([name, { value, id_unit }]) => ({ name, value, id_unit }))
      .sort((a, b) => b.value - a.value);
  }, [filteredLaporan]);

  const handleBarClick = (data) => {
    const payload = data?.activePayload?.[0]?.payload || data?.payload || data;
    if (payload?.id_unit) {
      navigate(`/laporan/review?unit=${payload.id_unit}`);
    }
  };

  const handleExport = async (format) => {
    if (exportStartDate && exportEndDate && exportStartDate > exportEndDate) {
      toast.error(t('export.invalid_date_range'));
      return;
    }

    const filters = {};
    if (filterUnit !== 'ALL') filters.id_unit = Number(filterUnit);
    if (filterStatus !== 'ALL_STATUS') filters.status = filterStatus;
    if (exportStartDate) filters.tanggal_mulai = exportStartDate;
    if (exportEndDate) filters.tanggal_akhir = exportEndDate;

    setIsExporting(format);
    try {
      const response = await exportApi.downloadLaporan(format, filters);
      const extension = format === 'xlsx' ? 'xlsx' : 'pdf';
      saveBlobResponse(response, `RACHE_Laporan.${extension}`);
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

  const renderTabContent = () => {
    switch(activeTab) {
      case 'kna': return <DashboardKNA laporanList={filteredLaporan} approvedLaporan={approvedLaporan} targetTahunan={sumTargetKategori('KNA')} />;
      case 'barang': return <DashboardBarang approvedLaporan={approvedLaporan} />;
      case 'penumpang': return <DashboardPenumpang approvedLaporan={approvedLaporan} />;
      case 'keuangan': return <DashboardKeuangan laporanList={filteredLaporan} approvedLaporan={approvedLaporan} targetTahunan={sumTargetKategori('KEUANGAN')} />;
      default:
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <StatCard 
                icon={FileText} color="brand" 
                label={t('admin.total_laporan')} value={totalLaporan.toString()} 
              />
              <StatCard 
                icon={Clock} color="amber" 
                label={t('admin.menunggu_review')} value={menungguReview.toString()} 
              />
              <StatCard 
                icon={CheckCircle} color="emerald" 
                label={t('admin.laporan_disetujui')} value={disetujui.toString()} 
              />
              <StatCard 
                icon={AlertTriangle} color="rose" 
                label={t('admin.perlu_revisi')} value={revisi.toString()} 
              />
            </div>

            <div className="card mb-6" style={{ padding: '24px' }}>
              <h3 className="section-title mb-4">{t('admin.volume_per_unit')}</h3>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }} onClick={handleBarClick}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} interval={0} tick={{ textAnchor: 'middle' }} height={50} />
                    <YAxis stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: 'var(--chart-grid)' }}
                      contentStyle={{ backgroundColor: 'var(--chart-card)', borderColor: 'var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', cursor: 'pointer' }}
                      itemStyle={{ color: 'var(--text-primary)', fontWeight: '500' }}
                    />
                    <Bar dataKey="value" name={t('admin.chart_legend')} fill="var(--chart-bar-primary)" radius={[6, 6, 0, 0]} barSize={40} onClick={handleBarClick} style={{ cursor: 'pointer' }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-0" style={{ padding: 0 }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                <h3 className="font-bold text-lg m-0">{t('admin.log_title')}</h3>
              </div>
              
              <div className="table-wrapper" style={{ border: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{t('admin.th_id')}</th>
                      <th>{t('admin.th_unit')}</th>
                      <th>{t('admin.th_time')}</th>
                      <th>{t('admin.th_type')}</th>
                      <th>{t('admin.th_status')}</th>
                      <th>{t('admin.th_action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted p-4">{t('admin.loading')}</td>
                      </tr>
                    ) : filteredLaporan.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted p-4">{t('admin.empty')}</td>
                      </tr>
                    ) : filteredLaporan.slice(0, 10).map((item) => (
                      <tr key={item.id_laporan}>
                        <td className="font-medium text-primary">LPR-{item.id_laporan}</td>
                        <td>{item.unit?.nama_unit || `Unit ID: ${item.id_unit}`}</td>
                        <td>{formatDateOnly(item.tanggal, { day: '2-digit', month: 'short', year: 'numeric' }, i18n.language)}</td>
                        <td>{t('dashboard.daily_data')}</td>
                        <td>
                          <span className={`badge ${item.status === 'DISETUJUI' ? 'badge-disetujui' : item.status === 'DITOLAK' || item.status === 'REVISI' ? 'badge-revisi' : 'badge-diajukan'}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>
                          <button 
                            className={`btn btn-sm ${item.status === 'DIAJUKAN' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => navigate(`/laporan/review/${item.id_laporan}`)}
                          >
                            {item.status === 'DIAJUKAN' ? t('admin.review') : t('admin.view')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        );
    }
  };

  const tabs = [
    { id: 'global', label: t('admin.global_summary'), icon: LayoutDashboard },
    { id: 'kna', label: t('unit.kna_title'), icon: Building2 },
    { id: 'barang', label: t('unit.barang_title'), icon: Truck },
    { id: 'penumpang', label: t('unit.penumpang_title'), icon: Users },
    { id: 'keuangan', label: t('unit.keuangan_title'), icon: Activity },
  ];

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <p className="page-subtitle">{t('admin.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
          <span className="text-xs font-semibold text-slate-500 mr-1 uppercase tracking-wider">{t('admin.export_filter')}</span>
          
          <input 
            type="date" 
            className="form-control text-sm" 
            style={{ width: 'auto', padding: '0.375rem 0.5rem' }} 
            value={exportStartDate} 
            onChange={(e) => setExportStartDate(e.target.value)}
            title={t('admin.start_date')}
            aria-label={t('admin.start_date')}
          />
          <span className="text-slate-400">-</span>
          <input 
            type="date" 
            className="form-control text-sm" 
            style={{ width: 'auto', padding: '0.375rem 0.5rem' }} 
            value={exportEndDate} 
            onChange={(e) => setExportEndDate(e.target.value)}
            title={t('admin.end_date')}
            aria-label={t('admin.end_date')}
          />

          <select aria-label={t('laporan.filter_unit')} className="form-control text-sm" style={{ width: 'auto', padding: '0.375rem 2rem 0.375rem 0.5rem' }} value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)}>
            <option value="ALL">{t('admin.semua_unit')}</option>
            {units.map((unit) => (
              <option key={unit.id_unit} value={unit.id_unit}>{unit.nama_unit}</option>
            ))}
          </select>
          <select aria-label={t('laporan.filter_status')} className="form-control text-sm" style={{ width: 'auto', padding: '0.375rem 2rem 0.375rem 0.5rem' }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="ALL_STATUS">{t('laporan.filter_status')}</option>
            <option value="DRAFT">DRAFT</option>
            <option value="DIAJUKAN">DIAJUKAN</option>
            <option value="DISETUJUI">DISETUJUI</option>
            <option value="REVISI">REVISI</option>
            <option value="DITOLAK">DITOLAK</option>
          </select>
          <div className="h-6 w-px bg-slate-300 mx-1"></div>
          <button type="button" disabled={Boolean(isExporting)} aria-busy={isExporting === 'xlsx'} className="btn btn-secondary flex items-center gap-1.5 text-sm py-1.5 px-3" onClick={handleExportExcel} style={{ backgroundColor: '#10b981', color: 'white', borderColor: '#059669', opacity: isExporting ? 0.65 : 1 }}>
            <FileSpreadsheet size={16} /> {isExporting === 'xlsx' ? t('export.processing') : 'Excel'}
          </button>
          <button type="button" disabled={Boolean(isExporting)} aria-busy={isExporting === 'pdf'} className="btn btn-secondary flex items-center gap-1.5 text-sm py-1.5 px-3" onClick={handleExportPDF} style={{ backgroundColor: '#ef4444', color: 'white', borderColor: '#dc2626', opacity: isExporting ? 0.65 : 1 }}>
            <Download size={16} /> {isExporting === 'pdf' ? t('export.processing') : 'PDF'}
          </button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', overflowX: 'auto' }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: '8px',
                backgroundColor: isActive ? 'var(--brand-50)' : 'transparent',
                color: isActive ? 'var(--brand-600)' : 'var(--text-muted)',
                fontWeight: isActive ? '600' : '500',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
              className="hover:bg-slate-100"
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* CONTENT */}
      {renderTabContent()}

    </div>
  );
};

export default DashboardAdmin;
