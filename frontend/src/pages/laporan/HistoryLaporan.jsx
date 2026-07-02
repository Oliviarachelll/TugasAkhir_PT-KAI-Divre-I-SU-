import React, { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Download, Filter, Eye } from 'lucide-react';
import useAuthStore from '../../store/auth.store';
import useLaporanStore from '../../store/laporan.store';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const HistoryLaporan = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.peran === 'ADMIN_GLOBAL';
  const navigate = useNavigate();
  const { laporanList, fetchLaporan, isLoading, setDraft } = useLaporanStore();
  const { t } = useTranslation();

  const [filterUnit, setFilterUnit] = useState('Semua Unit');
  const [filterStatus, setFilterStatus] = useState('Semua Status');
  const [filterBulan, setFilterBulan] = useState('');

  useEffect(() => {
    fetchLaporan();
  }, [fetchLaporan]);

  const handleUserAction = (laporan) => {
    if (laporan.status === 'REVISI' || laporan.status === 'DRAFT') {
      const mappedDraft = {
        id_laporan: laporan.id_laporan,
        jenis_laporan: 'Data Harian',
        tanggal: laporan.tanggal.split('T')[0],
        id_unit: laporan.id_unit,
        status: laporan.status,
        kotak_detail: laporan.kotak_detail,
        kna: laporan.laporan_kna || null,
        keuangan: laporan.laporan_keuangan || null,
        penumpangItems: laporan.laporan_penumpang || [],
        barangItems: (laporan.laporan_barang || []).filter(b => b.id_komoditi !== 99),
        barangTotal: (laporan.laporan_barang || []).find(b => b.id_komoditi === 99) || {},
      };
      setDraft(mappedDraft);
      navigate('/laporan/input');
    } else {
      navigate(`/laporan/detail/${laporan.id_laporan}`);
    }
  };

  // Compute filtered list
  const filteredList = laporanList.filter((item) => {
    // Filter Unit
    if (filterUnit !== 'Semua Unit' && item.unit?.nama_unit !== filterUnit) {
      return false;
    }
    // Filter Status
    if (filterStatus !== 'Semua Status' && item.status !== filterStatus) {
      return false;
    }
    // Filter Bulan
    if (filterBulan) {
      const itemMonth = new Date(item.tanggal).toISOString().slice(0, 7); // YYYY-MM
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

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text('Data History Laporan', 14, 15);
    
    const tableData = filteredList.map(item => [
      new Date(item.tanggal).toLocaleDateString('id-ID'),
      isAdmin ? (item.unit?.nama_unit || '-') : (item.pengguna?.nama || '-'),
      'Data Harian',
      item.status
    ]);

    doc.autoTable({
      head: [['Tanggal', isAdmin ? 'Unit' : 'Disubmit Oleh', 'Jenis', 'Status']],
      body: tableData,
      startY: 20,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [0, 58, 112] } // KAI Navy
    });

    doc.save('History_Laporan_KAI.pdf');
  };

  const handleExportExcel = () => {
    const excelData = filteredList.map(item => ({
      'Tanggal': new Date(item.tanggal).toLocaleDateString('id-ID'),
      'Unit / Pengguna': isAdmin ? (item.unit?.nama_unit || '-') : (item.pengguna?.nama || '-'),
      'Jenis Laporan': 'Data Harian',
      'Status': item.status
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "History");
    
    XLSX.writeFile(workbook, "History_Laporan_KAI.xlsx");
  };

  return (
    <div>
      
      <div className="page-header">
        <div>
          <div className="text-sm text-muted font-medium mb-1">{t('menu.laporan')} <span className="mx-1">&gt;</span> <span className="text-primary">{t('laporan.history_title')}</span></div>
        </div>
      </div>

      <div className="card mb-4" style={{ padding: '16px 24px', marginBottom: '24px' }}>
        <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="flex gap-3" style={{ display: 'flex', gap: '12px' }}>
            {isAdmin && (
              <select 
                className="form-control form-control-sm" 
                style={{ width: 'auto', padding: '6px 12px' }}
                value={filterUnit}
                onChange={(e) => setFilterUnit(e.target.value)}
              >
                <option>Semua Unit</option>
                <option>Unit KNA</option>
                <option>Unit Angkutan Penumpang</option>
                <option>Unit Angkutan Barang</option>
                <option>Unit Keuangan</option>
              </select>
            )}
            <select 
              className="form-control form-control-sm" 
              style={{ width: 'auto', padding: '6px 12px' }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option>Semua Status</option>
              <option>DIAJUKAN</option>
              <option>DISETUJUI</option>
              <option>REVISI</option>
              <option>DITOLAK</option>
            </select>
            <input 
              type="month" 
              className="form-control form-control-sm" 
              style={{ width: 'auto', padding: '6px 12px' }} 
              value={filterBulan}
              onChange={(e) => setFilterBulan(e.target.value)}
            />
          </div>
          <div className="flex gap-2" style={{ display: 'flex', gap: '8px' }}>
            {isAdmin && <button className="btn btn-secondary btn-sm" onClick={handleExportExcel}>Export Excel</button>}
            <button className="btn btn-secondary btn-sm" onClick={handleExportPDF}>Export PDF</button>
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
                <th>Tgl Laporan</th>
                {isAdmin && <th>Unit</th>}
                <th>Jenis</th>
                {isAdmin && <th>Disubmit Oleh</th>}
                <th>Status</th>
                {!isAdmin && <th>Catatan Revisi</th>}
                {isAdmin && <th>Reviewer</th>}
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="text-center p-4">Memuat data...</td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="text-center p-4 text-muted">Belum ada laporan yang cocok dengan filter.</td>
                </tr>
              ) : (
                filteredList.map((laporan) => {
                  const tgl = new Date(laporan.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                  let badgeClass = 'badge-diajukan';
                  if (laporan.status === 'DISETUJUI') badgeClass = 'badge-disetujui';
                  if (laporan.status === 'DITOLAK' || laporan.status === 'REVISI') badgeClass = 'badge-revisi';

                  return (
                    <tr key={laporan.id_laporan}>
                      <td>{tgl}</td>
                      {isAdmin && <td>{laporan.unit?.nama_unit || '-'}</td>}
                      <td>Data Harian</td>
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
                          {isAdmin ? (laporan.status === 'DIAJUKAN' ? 'Review' : 'Lihat') : ((laporan.status === 'REVISI' || laporan.status === 'DRAFT') ? 'Edit' : 'Lihat')}
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
