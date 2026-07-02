import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
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

const DashboardAdmin = () => {
  const navigate = useNavigate();
  const { laporanList, fetchLaporan, isLoading } = useLaporanStore();
  const { t } = useTranslation();
  
  const [activeTab, setActiveTab] = useState('global');
  const [filterUnit, setFilterUnit] = useState('Semua Unit');

  useEffect(() => {
    fetchLaporan({ limit: 500 }); // Ambil lebih banyak untuk dashboard admin global
  }, [fetchLaporan]);

  const filteredLaporan = useMemo(() => {
    if (filterUnit === 'Semua Unit') return laporanList;
    return laporanList.filter(l => l.unit?.nama_unit === filterUnit);
  }, [laporanList, filterUnit]);

  const approvedLaporan = useMemo(() => {
    return filteredLaporan.filter(l => l.status === 'DISETUJUI');
  }, [filteredLaporan]);

  // Hitung Metrik Global
  const totalLaporan = filteredLaporan.length;
  const menungguReview = filteredLaporan.filter(l => l.status === 'DIAJUKAN').length;
  const disetujui = filteredLaporan.filter(l => l.status === 'DISETUJUI').length;
  const revisi = filteredLaporan.filter(l => l.status === 'REVISI' || l.status === 'DITOLAK').length;

  // Chart Data: Laporan per Unit (Top 7)
  const chartData = useMemo(() => {
    const unitMap = {};
    filteredLaporan.forEach(l => {
      const namaUnit = l.unit?.nama_unit || `Unit ID: ${l.id_unit}`;
      if (!unitMap[namaUnit]) unitMap[namaUnit] = 0;
      unitMap[namaUnit]++;
    });
    
    return Object.entries(unitMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7); // Top 7 unit
  }, [filteredLaporan]);

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Laporan Metrik Angka KAI', 14, 15);
      doc.setFontSize(10);
      doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 22);
      
      let currentY = 28;

      // 1. Data KNA
      const knaData = approvedLaporan.filter(l => l.laporan_kna).map(l => [
        new Date(l.tanggal).toLocaleDateString('id-ID'),
        `Rp ${(parseFloat(l.laporan_kna.target_rkad) || 0).toLocaleString('id-ID')}`,
        `Rp ${(parseFloat(l.laporan_kna.realisasi_rkad) || 0).toLocaleString('id-ID')}`
      ]);
      if (knaData.length > 0) {
        doc.autoTable({
          head: [['Tanggal Lapor', 'Target RKAD (KNA)', 'Realisasi RKAD (KNA)']],
          body: knaData,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [44, 62, 80] }
        });
        currentY = (doc.lastAutoTable?.finalY || doc.autoTable?.previous?.finalY || currentY) + 10;
      }

      // 2. Data Keuangan
      const keuData = approvedLaporan.filter(l => l.laporan_keuangan).map(l => [
        new Date(l.tanggal).toLocaleDateString('id-ID'),
        `Rp ${(parseFloat(l.laporan_keuangan.pendapatan) || 0).toLocaleString('id-ID')}`,
        `Rp ${(parseFloat(l.laporan_keuangan.pengeluaran) || 0).toLocaleString('id-ID')}`
      ]);
      if (keuData.length > 0) {
        if (currentY > 250) { doc.addPage(); currentY = 15; }
        doc.autoTable({
          head: [['Tanggal Lapor', 'Pendapatan Keuangan', 'Pengeluaran Keuangan']],
          body: keuData,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [39, 174, 96] }
        });
        currentY = (doc.lastAutoTable?.finalY || doc.autoTable?.previous?.finalY || currentY) + 10;
      }

      // 3. Data Barang
      const brgData = approvedLaporan.filter(l => l.laporan_barang).map(l => {
        const totalBrg = l.laporan_barang.find(i => i.id_komoditi === 99) || {};
        return [
          new Date(l.tanggal).toLocaleDateString('id-ID'),
          `Rp ${(parseFloat(totalBrg.pendapatan) || 0).toLocaleString('id-ID')}`,
          `${(parseFloat(totalBrg.volume) || 0).toLocaleString('id-ID')} Ton`
        ];
      });
      if (brgData.length > 0) {
        if (currentY > 250) { doc.addPage(); currentY = 15; }
        doc.autoTable({
          head: [['Tanggal Lapor', 'Total Pendapatan Barang', 'Total Volume Barang']],
          body: brgData,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [211, 84, 0] }
        });
        currentY = (doc.lastAutoTable?.finalY || doc.autoTable?.previous?.finalY || currentY) + 10;
      }

      // 4. Data Penumpang
      const pnpData = approvedLaporan.filter(l => l.laporan_penumpang && l.laporan_penumpang.length > 0).map(l => {
        let totPendapatan = 0;
        let totVolume = 0;
        l.laporan_penumpang.forEach(p => {
          totPendapatan += parseFloat(p.pendapatan) || 0;
          totVolume += parseFloat(p.volume) || 0;
        });
        return [
          new Date(l.tanggal).toLocaleDateString('id-ID'),
          `Rp ${totPendapatan.toLocaleString('id-ID')}`,
          `${totVolume.toLocaleString('id-ID')} Orang`
        ];
      });
      if (pnpData.length > 0) {
        if (currentY > 250) { doc.addPage(); currentY = 15; }
        doc.autoTable({
          head: [['Tanggal Lapor', 'Total Pendapatan Penumpang', 'Total Volume Penumpang']],
          body: pnpData,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [142, 68, 173] }
        });
      }

      doc.save('Laporan_Metrik_Angka_Admin.pdf');
    } catch (err) {
      alert("Gagal mengekspor PDF: " + err.message);
      console.error(err);
    }
  };

  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // 1. Data KNA
    const knaData = approvedLaporan.filter(l => l.laporan_kna).map(l => {
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
      const wsKna = XLSX.utils.aoa_to_sheet([
        ['Tanggal', 'Target RKAD', 'Realisasi RKAD', 'Nilai ROW', 'Nilai Non-ROW', 'Visualisasi Realisasi'],
        ...knaData.map((row, idx) => [
          ...row,
          { t: 's', f: `REPT("█", C${idx + 2}/10000000)` } // Asumsi satuan 10 juta
        ])
      ]);
      wsKna['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(wb, wsKna, "Data KNA");
    }

    // 3. Data Keuangan
    const keuData = approvedLaporan.filter(l => l.laporan_keuangan).map(l => {
      const keu = l.laporan_keuangan;
      return [
        new Date(l.tanggal).toLocaleDateString('id-ID'),
        parseFloat(keu.pendapatan) || 0,
        parseFloat(keu.pengeluaran) || 0
      ];
    });
    if (keuData.length > 0) {
      const wsKeu = XLSX.utils.aoa_to_sheet([
        ['Tanggal', 'Pendapatan', 'Pengeluaran', 'Visualisasi Pendapatan'],
        ...keuData.map((row, idx) => [
          ...row,
          { t: 's', f: `REPT("█", B${idx + 2}/10000000)` } // Asumsi satuan 10 juta
        ])
      ]);
      wsKeu['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(wb, wsKeu, "Data Keuangan");
    }

    // 4. Data Barang
    const brgData = approvedLaporan.filter(l => l.laporan_barang).map(l => {
      const totalBarang = l.laporan_barang.find(i => i.id_komoditi === 99) || {};
      return [
        new Date(l.tanggal).toLocaleDateString('id-ID'),
        parseFloat(totalBarang.pendapatan) || 0,
        parseFloat(totalBarang.volume) || 0
      ];
    });
    if (brgData.length > 0) {
      const wsBrg = XLSX.utils.aoa_to_sheet([
        ['Tanggal', 'Pendapatan Barang', 'Volume Barang', 'Visualisasi Volume'],
        ...brgData.map((row, idx) => [
          ...row,
          { t: 's', f: `REPT("█", C${idx + 2}/10)` } // Asumsi batang skala puluhan ton
        ])
      ]);
      wsBrg['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(wb, wsBrg, "Data Barang");
    }

    // 5. Data Penumpang
    const pnpData = approvedLaporan.filter(l => l.laporan_penumpang && l.laporan_penumpang.length > 0).map(l => {
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
      const wsPnp = XLSX.utils.aoa_to_sheet([
        ['Tanggal', 'Pendapatan Penumpang', 'Volume Penumpang', 'Visualisasi Volume'],
        ...pnpData.map((row, idx) => [
          ...row,
          { t: 's', f: `REPT("█", C${idx + 2}/50)` } // Asumsi batang skala 50 org
        ])
      ]);
      wsPnp['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(wb, wsPnp, "Data Penumpang");
    }

      XLSX.writeFile(wb, "Laporan_Metrik_Angka_Admin.xlsx");
    } catch (err) {
      alert("Gagal mengekspor Excel: " + err.message);
      console.error(err);
    }
  };

  const renderTabContent = () => {
    switch(activeTab) {
      case 'kna': return <DashboardKNA laporanList={filteredLaporan} approvedLaporan={approvedLaporan} />;
      case 'barang': return <DashboardBarang approvedLaporan={approvedLaporan} />;
      case 'penumpang': return <DashboardPenumpang approvedLaporan={approvedLaporan} />;
      case 'keuangan': return <DashboardKeuangan approvedLaporan={approvedLaporan} />;
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
              <h3 className="section-title mb-4">Volume Laporan per Unit (Top 7)</h3>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} angle={-30} textAnchor="end" />
                    <YAxis stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{ fill: '#F9FAFB' }}
                      contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#F3F4F6', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
                      itemStyle={{ color: '#111827', fontWeight: '500' }}
                    />
                    <Bar dataKey="value" name="Jml Laporan" fill="var(--brand-500)" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-0" style={{ padding: 0 }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                <h3 className="font-bold text-lg m-0">Log Riwayat Laporan Terbaru</h3>
              </div>
              
              <div className="table-wrapper" style={{ border: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>ID LAPORAN</th>
                      <th>NAMA UNIT</th>
                      <th>WAKTU LAPOR</th>
                      <th>JENIS</th>
                      <th>STATUS</th>
                      <th>AKSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted p-4">Memuat data...</td>
                      </tr>
                    ) : filteredLaporan.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted p-4">Tidak ada data laporan.</td>
                      </tr>
                    ) : filteredLaporan.slice(0, 10).map((item) => (
                      <tr key={item.id_laporan}>
                        <td className="font-medium text-primary">LPR-{item.id_laporan}</td>
                        <td>{item.unit?.nama_unit || `Unit ID: ${item.id_unit}`}</td>
                        <td>{new Date(item.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td>Data Harian</td>
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
                            {item.status === 'DIAJUKAN' ? 'Review' : 'Lihat'}
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
    { id: 'global', label: 'Ringkasan Global', icon: LayoutDashboard },
    { id: 'kna', label: t('unit.kna_title'), icon: Building2 },
    { id: 'barang', label: t('unit.barang_title'), icon: Truck },
    { id: 'penumpang', label: t('unit.penumpang_title'), icon: Users },
    { id: 'keuangan', label: t('unit.keuangan_title'), icon: Activity },
  ];

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div>
          <p className="page-subtitle">{t('admin.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <select className="form-control" style={{ width: 'auto' }} value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)}>
            <option>Semua Unit</option>
            <option>Unit Pusat</option>
            <option>Unit Angkutan Penumpang</option>
            <option>Unit Angkutan Barang</option>
            <option>Unit Keuangan</option>
            <option>Unit KNA</option>
          </select>
          <button className="btn btn-secondary flex items-center gap-2 text-sm" onClick={handleExportExcel} style={{ backgroundColor: '#10b981', color: 'white', borderColor: '#059669' }}>
            <FileSpreadsheet size={16} /> Excel
          </button>
          <button className="btn btn-secondary flex items-center gap-2 text-sm" onClick={handleExportPDF} style={{ backgroundColor: '#ef4444', color: 'white', borderColor: '#dc2626' }}>
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
