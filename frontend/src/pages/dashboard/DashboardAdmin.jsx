import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
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
import { formatDate } from '../../utils/format';

const DashboardAdmin = () => {
  const navigate = useNavigate();
  const { laporanList, fetchLaporan, isLoading } = useLaporanStore();
  const { t, i18n } = useTranslation();
  
  const [activeTab, setActiveTab] = useState('global');
  const [filterUnit, setFilterUnit] = useState('ALL');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  useEffect(() => {
    fetchLaporan({ limit: 500 }); // Ambil lebih banyak untuk dashboard admin global
  }, [fetchLaporan]);

  const filteredLaporan = useMemo(() => {
    return laporanList;
  }, [laporanList]);

  const approvedLaporan = useMemo(() => {
    return filteredLaporan.filter(l => l.status === 'DISETUJUI');
  }, [filteredLaporan]);

  const laporanToExport = useMemo(() => {
    return approvedLaporan.filter(l => {
      let match = true;
      if (filterUnit !== 'ALL') {
        if (l.unit?.nama_unit !== filterUnit) match = false;
      }
      if (exportStartDate) {
        if (new Date(l.tanggal) < new Date(exportStartDate)) match = false;
      }
      if (exportEndDate) {
        // End date should include the whole day
        const end = new Date(exportEndDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(l.tanggal) > end) match = false;
      }
      return match;
    });
  }, [approvedLaporan, filterUnit, exportStartDate, exportEndDate]);



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
      if (!unitMap[namaUnit]) unitMap[namaUnit] = 0;
      unitMap[namaUnit]++;
    });
    
    return Object.entries(unitMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredLaporan]);

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      
      const drawHeader = (doc, title) => {
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
        doc.setTextColor(30, 136, 229);
        doc.text("PT KERETA API INDONESIA (PERSERO)", 50, 16);
        
        // Address
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text("DIVISI REGIONAL I SUMATERA UTARA", 50, 22);
        
        // Line
        doc.setLineWidth(0.5);
        doc.setDrawColor(0, 0, 0);
        doc.line(14, 26, 196, 26);
        
        // Title
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(title, 14, 36);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 42);
      };

      let isFirstPage = true;

      // 1. Data KNA
      const knaData = laporanToExport.filter(l => l.laporan_kna).map(l => [
        new Date(l.tanggal).toLocaleDateString('id-ID'),
        `Rp ${(parseFloat(l.laporan_kna.target_rkad) || 0).toLocaleString('id-ID')}`,
        `Rp ${(parseFloat(l.laporan_kna.realisasi_rkad) || 0).toLocaleString('id-ID')}`
      ]);
      if (knaData.length > 0) {
        if (!isFirstPage) doc.addPage();
        drawHeader(doc, 'Laporan: Unit KNA');
        autoTable(doc, {
          head: [['Tanggal Lapor', 'Target RKAD (KNA)', 'Realisasi RKAD (KNA)']],
          body: knaData,
          startY: 48,
          theme: 'grid',
          headStyles: { fillColor: [0, 58, 112] }
        });
        isFirstPage = false;
      }

      // 2. Data Keuangan
      const keuData = laporanToExport.filter(l => l.laporan_keuangan).map(l => [
        new Date(l.tanggal).toLocaleDateString('id-ID'),
        `Rp ${(parseFloat(l.laporan_keuangan.target_rkad) || 0).toLocaleString('id-ID')}`,
        `Rp ${(parseFloat(l.laporan_keuangan.realisasi_rkad) || 0).toLocaleString('id-ID')}`,
        `Rp ${(parseFloat(l.laporan_keuangan.pendapatan) || 0).toLocaleString('id-ID')}`,
        `Rp ${(parseFloat(l.laporan_keuangan.pengeluaran) || 0).toLocaleString('id-ID')}`
      ]);
      if (keuData.length > 0) {
        if (!isFirstPage) doc.addPage();
        drawHeader(doc, 'Laporan: Unit Keuangan');
        autoTable(doc, {
          head: [['Tanggal Lapor', 'Target RKAD', 'Realisasi RKAD', 'Pendapatan', 'Pengeluaran']],
          body: keuData,
          startY: 48,
          theme: 'grid',
          headStyles: { fillColor: [0, 58, 112] }
        });
        isFirstPage = false;
      }

      // 3. Data Barang
      const brgData = laporanToExport.filter(l => l.laporan_barang && l.laporan_barang.length > 0).map(l => {
        let totPendapatan = 0;
        let totVolume = 0;
        l.laporan_barang.forEach(b => {
          totPendapatan += parseFloat(b.pendapatan) || 0;
          totVolume += parseFloat(b.volume) || 0;
        });
        return [
          new Date(l.tanggal).toLocaleDateString('id-ID'),
          `Rp ${totPendapatan.toLocaleString('id-ID')}`,
          `${totVolume.toLocaleString('id-ID')} Ton`
        ];
      });
      if (brgData.length > 0) {
        if (!isFirstPage) doc.addPage();
        drawHeader(doc, 'Laporan: Unit Angkutan Barang');
        autoTable(doc, {
          head: [['Tanggal Lapor', 'Total Pendapatan Barang', 'Total Volume Barang']],
          body: brgData,
          startY: 48,
          theme: 'grid',
          headStyles: { fillColor: [0, 58, 112] }
        });
        isFirstPage = false;
      }

      // 4. Data Penumpang
      const pnpData = laporanToExport.filter(l => l.laporan_penumpang && l.laporan_penumpang.length > 0).map(l => {
        let totPendapatan = 0;
        let totVolume = 0;
        l.laporan_penumpang.forEach(p => {
          totPendapatan += parseFloat(p.pendapatan) || 0;
          totVolume += parseFloat(p.jml_penumpang) || 0;
        });
        return [
          new Date(l.tanggal).toLocaleDateString('id-ID'),
          `Rp ${totPendapatan.toLocaleString('id-ID')}`,
          `${totVolume.toLocaleString('id-ID')} Orang`
        ];
      });
      if (pnpData.length > 0) {
        if (!isFirstPage) doc.addPage();
        drawHeader(doc, 'Laporan: Unit Angkutan Penumpang');
        autoTable(doc, {
          head: [['Tanggal Lapor', 'Total Pendapatan Penumpang', 'Total Penumpang']],
          body: pnpData,
          startY: 48,
          theme: 'grid',
          headStyles: { fillColor: [0, 58, 112] }
        });
        isFirstPage = false;
      }
      
      if (isFirstPage) {
        drawHeader(doc, 'Laporan Metrik Angka KAI');
        doc.text("Tidak ada data laporan.", 14, 48);
      }

      // Add signature block at the end
      const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 20 : 60;
      // Check if we need a new page for the signature
      if (finalY > 250) {
        doc.addPage();
        drawHeader(doc, 'Pengesahan Laporan');
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

      doc.save('Laporan_Metrik_Angka_Admin.pdf');
    } catch (err) {
      alert(t('admin.export_pdf_fail') + err.message);
      console.error(err);
    }
  };

  const handleExportExcel = async () => {
    try {
      // 1. Fetch template.xlsx from the public folder
      const response = await fetch('/template.xlsx');
      if (!response.ok) {
        throw new Error(t('admin.template_fail'));
      }
      const arrayBuffer = await response.arrayBuffer();
      
      // 2. Load the template into a new workbook
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      workbook.creator = 'PT KAI Divre I SU';

      // 3. Fill Data KNA
      const knaData = laporanToExport.filter(l => l.laporan_kna).map(l => {
        const kna = l.laporan_kna;
        return [
          new Date(l.tanggal).toLocaleDateString('id-ID'),
          parseFloat(kna.target_rkad) || 0,
          parseFloat(kna.realisasi_rkad) || 0,
          parseFloat(kna.nilai_row) || 0,
          parseFloat(kna.nilai_non_row) || 0
        ];
      });

      if (knaData.length > 0) {
        const wsKna = workbook.getWorksheet('Data KNA');
        if (wsKna) {
          knaData.forEach((row, i) => {
            const rowIndex = i + 2;
            const [tanggal, target, realisasi, rowVal, nonRowVal] = row;
            wsKna.getCell(`A${rowIndex}`).value = tanggal;
            wsKna.getCell(`B${rowIndex}`).value = target;
            wsKna.getCell(`C${rowIndex}`).value = realisasi;
            wsKna.getCell(`D${rowIndex}`).value = rowVal;
            wsKna.getCell(`E${rowIndex}`).value = nonRowVal;
          });
        }
      }

      // 4. Fill Data Keuangan
      const keuData = laporanToExport.filter(l => l.laporan_keuangan).map(l => {
        const keu = l.laporan_keuangan;
        return [
          new Date(l.tanggal).toLocaleDateString('id-ID'),
          parseFloat(keu.target_rkad) || 0,
          parseFloat(keu.realisasi_rkad) || 0,
          parseFloat(keu.pendapatan) || 0,
          parseFloat(keu.pengeluaran) || 0
        ];
      });

      if (keuData.length > 0) {
        const wsKeu = workbook.getWorksheet('Data Keuangan');
        if (wsKeu) {
          keuData.forEach((row, i) => {
            const rowIndex = i + 2;
            const [tanggal, targetRkad, realisasiRkad, pendapatan, pengeluaran] = row;
            wsKeu.getCell(`A${rowIndex}`).value = tanggal;
            wsKeu.getCell(`B${rowIndex}`).value = targetRkad;
            wsKeu.getCell(`C${rowIndex}`).value = realisasiRkad;
            wsKeu.getCell(`D${rowIndex}`).value = pendapatan;
            wsKeu.getCell(`E${rowIndex}`).value = pengeluaran;
          });
        }
      }

      // 5. Fill Data Barang
      const brgData = laporanToExport.filter(l => l.laporan_barang).map(l => {
        let metrics = { barangPendapatan: 0, barangVolume: 0 };
        if (l.laporan_barang && l.laporan_barang.length > 0) {
          l.laporan_barang.forEach(b => {
            metrics.barangPendapatan += parseFloat(b.pendapatan) || 0;
            metrics.barangVolume += parseFloat(b.volume) || 0;
          });
        }
        return [
          new Date(l.tanggal).toLocaleDateString('id-ID'),
          metrics.barangPendapatan,
          metrics.barangVolume
        ];
      });

      if (brgData.length > 0) {
        const wsBrg = workbook.getWorksheet('Data Barang');
        if (wsBrg) {
          brgData.forEach((row, i) => {
            const rowIndex = i + 2;
            const [tanggal, pendapatan, volume] = row;
            wsBrg.getCell(`A${rowIndex}`).value = tanggal;
            wsBrg.getCell(`B${rowIndex}`).value = pendapatan;
            wsBrg.getCell(`C${rowIndex}`).value = volume;
          });
        }
      }

      // 6. Fill Data Penumpang
      const pnpData = laporanToExport.filter(l => l.laporan_penumpang && l.laporan_penumpang.length > 0).map(l => {
        let totPendapatan = 0;
        let totVolume = 0;
        l.laporan_penumpang.forEach(p => {
          totPendapatan += parseFloat(p.pendapatan) || 0;
          totVolume += parseFloat(p.volume) || 0;
        });
        return [
          new Date(l.tanggal).toLocaleDateString('id-ID'),
          totPendapatan,
          totVolume
        ];
      });

      if (pnpData.length > 0) {
        const wsPnp = workbook.getWorksheet('Data Penumpang');
        if (wsPnp) {
          pnpData.forEach((row, i) => {
            const rowIndex = i + 2;
            const [tanggal, pendapatan, volume] = row;
            wsPnp.getCell(`A${rowIndex}`).value = tanggal;
            wsPnp.getCell(`B${rowIndex}`).value = pendapatan;
            wsPnp.getCell(`C${rowIndex}`).value = volume;
          });
        }
      }

      // 7. Download file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, "Laporan_Metrik_Angka_Admin_Keren.xlsx");
      
    } catch (err) {
      alert(t('admin.export_excel_fail') + err.message);
      console.error(err);
    }
  };

  const renderTabContent = () => {
    switch(activeTab) {
      case 'kna': return <DashboardKNA laporanList={filteredLaporan} approvedLaporan={approvedLaporan} />;
      case 'barang': return <DashboardBarang approvedLaporan={approvedLaporan} />;
      case 'penumpang': return <DashboardPenumpang approvedLaporan={approvedLaporan} />;
      case 'keuangan': return <DashboardKeuangan laporanList={filteredLaporan} approvedLaporan={approvedLaporan} />;
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
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} angle={-30} textAnchor="end" />
                    <YAxis stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{ fill: 'var(--chart-grid)' }}
                      contentStyle={{ backgroundColor: 'var(--chart-card)', borderColor: 'var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}
                      itemStyle={{ color: 'var(--text-primary)', fontWeight: '500' }}
                    />
                    <Bar dataKey="value" name={t('admin.chart_legend')} fill="var(--chart-bar-primary)" radius={[6, 6, 0, 0]} barSize={40} />
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
                        <td>{formatDate(item.tanggal, { day: '2-digit', month: 'short', year: 'numeric' }, i18n.language)}</td>
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
          />
          <span className="text-slate-400">-</span>
          <input 
            type="date" 
            className="form-control text-sm" 
            style={{ width: 'auto', padding: '0.375rem 0.5rem' }} 
            value={exportEndDate} 
            onChange={(e) => setExportEndDate(e.target.value)}
            title={t('admin.end_date')}
          />

          <select className="form-control text-sm" style={{ width: 'auto', padding: '0.375rem 2rem 0.375rem 0.5rem' }} value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)}>
            <option value="ALL">{t('admin.semua_unit')}</option>
            <option value="Unit Pusat">{t('admin.unit_pusat')}</option>
            <option value="Unit Angkutan Penumpang">{t('admin.unit_penumpang')}</option>
            <option value="Unit Angkutan Barang">{t('admin.unit_barang')}</option>
            <option value="Unit Keuangan">{t('admin.unit_keuangan')}</option>
            <option value="Unit KNA">{t('admin.unit_kna')}</option>
          </select>
          <div className="h-6 w-px bg-slate-300 mx-1"></div>
          <button className="btn btn-secondary flex items-center gap-1.5 text-sm py-1.5 px-3" onClick={handleExportExcel} style={{ backgroundColor: '#10b981', color: 'white', borderColor: '#059669' }}>
            <FileSpreadsheet size={16} /> Excel
          </button>
          <button className="btn btn-secondary flex items-center gap-1.5 text-sm py-1.5 px-3" onClick={handleExportPDF} style={{ backgroundColor: '#ef4444', color: 'white', borderColor: '#dc2626' }}>
            <Download size={16} /> PDF
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
