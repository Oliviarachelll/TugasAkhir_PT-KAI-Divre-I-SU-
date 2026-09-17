import { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import useAuthStore from '../../store/auth.store';
import useLaporanStore from '../../store/laporan.store';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../utils/format';

const HistoryLaporan = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.peran === 'ADMIN_GLOBAL';
  const navigate = useNavigate();
  const { laporanList, fetchLaporan, isLoading, setDraft } = useLaporanStore();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const [filterUnit, setFilterUnit] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL_STATUS');
  const [filterBulan, setFilterBulan] = useState('');

  useEffect(() => {
    fetchLaporan();
  }, [fetchLaporan]);

  const handleUserAction = (laporan) => {
    if (laporan.status === 'REVISI' || laporan.status === 'DRAFT') {
      let barangTotal = (laporan.laporan_barang || []).find(b => b.id_komoditi === 99) || {};
      if (Object.keys(barangTotal).length === 0 && laporan.laporan_barang && laporan.laporan_barang.length > 0) {
        let autoVolume = 0;
        let autoPendapatan = 0;
        laporan.laporan_barang.forEach(b => {
          autoVolume += parseFloat(b.volume) || 0;
          autoPendapatan += parseFloat(b.pendapatan) || 0;
        });
        barangTotal = { volume: autoVolume, pendapatan: autoPendapatan };
      }

      const pendapatanKa = (laporan.laporan_penumpang || []).reduce((result, item) => {
        result[item.nama_ka] = (result[item.nama_ka] || 0) + (Number(item.pendapatan) || 0);
        return result;
      }, {});

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
        pendapatanKa,
        barangItems: (laporan.laporan_barang || []).filter(b => b.id_komoditi !== 99),
        barangTotal: barangTotal,
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
    if (filterUnit !== 'ALL' && item.unit?.nama_unit !== filterUnit) {
      return false;
    }
    // Filter Status
    if (filterStatus !== 'ALL_STATUS' && item.status !== filterStatus) {
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
    // Official document: content inside the exported PDF stays in Indonesian (id-ID) by design.
    const doc = new jsPDF();
    
    // Fungsi untuk menggambar kop surat KAI
    const drawHeader = (doc) => {
      // Simulate KAI Logo with text
      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(32);
      doc.setTextColor(0, 58, 112); // KAI Navy
      doc.text("K", 14, 22);
      doc.text("A", 27, 22);
      doc.setTextColor(243, 112, 33); // KAI Orange
      doc.text("I", 40, 22);

      // Company name
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 136, 229); // Blue text
      doc.text("PT KERETA API INDONESIA (PERSERO)", 50, 16);
      
      // Address
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0); // Black text
      doc.text("DIVISI REGIONAL I SUMATERA UTARA", 50, 22);
      
      // Horizontal Line
      doc.setLineWidth(0.5);
      doc.setDrawColor(0, 0, 0);
      doc.line(14, 26, 196, 26);
    };

    // Grouping by Unit
    const grouped = {};
    filteredList.forEach(item => {
      const unitName = isAdmin ? (item.unit?.nama_unit || 'Tanpa Unit') : (item.pengguna?.nama || 'Saya');
      if (!grouped[unitName]) grouped[unitName] = [];
      grouped[unitName].push(item);
    });

    const unitNames = Object.keys(grouped);
    
    unitNames.forEach((unitName, index) => {
      if (index > 0) doc.addPage();
      
      drawHeader(doc);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`Laporan: ${unitName}`, 14, 36);
      
      const tableData = grouped[unitName].map(item => [
        new Date(item.tanggal).toLocaleDateString('id-ID'),
        'Data Harian',
        item.status,
        isAdmin ? (item.pengguna?.nama || '-') : (item.kotak_detail || '—')
      ]);

      autoTable(doc, {
        head: [['Tanggal', 'Jenis', 'Status', isAdmin ? 'Disubmit Oleh' : 'Catatan Revisi']],
        body: tableData,
        startY: 42,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [0, 58, 112] } // KAI Navy
      });

      // Add signature block at the end of each unit's report
      const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 20 : 60;
      if (finalY > 250) {
        doc.addPage();
        drawHeader(doc);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text("Medan, " + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), 140, 48);
        doc.text("Mengetahui,", 140, 56);
        doc.text("Manager / Vice President", 140, 64);
        doc.text("______________________", 140, 94);
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text("Medan, " + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), 140, finalY);
        doc.text("Mengetahui,", 140, finalY + 8);
        doc.text("Manager / Vice President", 140, finalY + 16);
        doc.text("______________________", 140, finalY + 46);
      }
    });

    if (unitNames.length === 0) {
       drawHeader(doc);
       doc.setFont("helvetica", "normal");
       doc.text("Tidak ada data laporan.", 14, 36);
    }

    doc.save('History_Laporan_KAI.pdf');
  };

  const handleExportExcel = () => {
    // Official document: content inside the exported Excel stays in Indonesian (id-ID) by design.
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
                <option value="ALL">{t('laporan.filter_unit')}</option>
                <option value="Unit KNA">Unit KNA</option>
                <option value="Unit Angkutan Penumpang">Unit Angkutan Penumpang</option>
                <option value="Unit Angkutan Barang">Unit Angkutan Barang</option>
                <option value="Unit Keuangan">Unit Keuangan</option>
              </select>
            )}
            <select 
              className="form-control form-control-sm" 
              style={{ width: 'auto', padding: '6px 12px' }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="ALL_STATUS">{t('laporan.filter_status')}</option>
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
            />
          </div>
          <div className="flex gap-2" style={{ display: 'flex', gap: '8px' }}>
            {isAdmin && <button className="btn btn-secondary btn-sm" onClick={handleExportExcel}>{t('laporan.export_excel')}</button>}
            <button className="btn btn-secondary btn-sm" onClick={handleExportPDF}>{t('laporan.export_pdf')}</button>
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
                  const tgl = formatDate(laporan.tanggal, { day: '2-digit', month: 'short', year: 'numeric' }, lang);
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
                          {isAdmin ? (laporan.status === 'DIAJUKAN' ? t('laporan.review') : t('laporan.view')) : ((laporan.status === 'REVISI' || laporan.status === 'DRAFT') ? t('laporan.edit') : t('laporan.view'))}
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
