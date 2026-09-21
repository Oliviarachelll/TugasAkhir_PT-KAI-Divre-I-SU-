import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { formatDate, formatNumber, formatCompact, currencyPrefix } from '../../../utils/format';

const DashboardKeuangan = ({ laporanList, approvedLaporan, targetTahunan = null }) => {
  const [chartDays, setChartDays] = useState(7);
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const cur = currencyPrefix(lang);

  // 1. Target RKAD tahunan dari tabel master (diisi unit 1x setahun).
  const hasMasterTarget = targetTahunan !== null && targetTahunan !== undefined && Number.isFinite(Number(targetTahunan));
  const targetRKAD = hasMasterTarget ? Number(targetTahunan) : 0;

  // 2. Kalkulasi Akumulasi Keuangan dari semua yang approved
  let totalRealisasiKeuangan = 0;
  let totalPendapatanKeuangan = 0;
  let totalPengeluaranKeuangan = 0;
  let totalLabaRugiKeuangan = 0;
  let totalSPJ = 0;
  let totalInvoice = 0;
  let countInvoiceBelumLunas = 0;
  let countSPJ = 0;
  let countTransaksi = 0;

  // realisasi_rkad tiap baris SUDAH kumulatif (dihitung backend), jadi total
  // = nilai kumulatif pada laporan terbaru, BUKAN jumlah semua baris.
  let latestTglKeu = '';
  approvedLaporan?.forEach(l => {
    if (l.laporan_keuangan) {
      const v = l.laporan_keuangan.realisasi_rkad ? parseFloat(l.laporan_keuangan.realisasi_rkad) : 0;
      const t = String(l.tanggal || '');
      if (t >= latestTglKeu) { latestTglKeu = t; totalRealisasiKeuangan = v; }
      totalPendapatanKeuangan += l.laporan_keuangan.pendapatan ? parseFloat(l.laporan_keuangan.pendapatan) : 0;
      totalPengeluaranKeuangan += l.laporan_keuangan.pengeluaran ? parseFloat(l.laporan_keuangan.pengeluaran) : 0;
      totalLabaRugiKeuangan += l.laporan_keuangan.laba_rugi ? parseFloat(l.laporan_keuangan.laba_rugi) : 0;

      if (l.laporan_keuangan.rincian_spj) {
        try {
          const spjs = JSON.parse(l.laporan_keuangan.rincian_spj);
          countSPJ += spjs.length;
          spjs.forEach(s => totalSPJ += parseFloat(s.nominal || 0));
        } catch (e) {}
      }

      if (l.laporan_keuangan.rincian_invoice) {
        try {
          const invs = JSON.parse(l.laporan_keuangan.rincian_invoice);
          countInvoiceBelumLunas += invs.filter(i => i.status === 'Belum Lunas').length;
          invs.forEach(i => totalInvoice += parseFloat(i.nominal || 0));
        } catch (e) {}
      }

      if (l.laporan_keuangan.rincian_transaksi) {
        try {
          const trans = JSON.parse(l.laporan_keuangan.rincian_transaksi);
          countTransaksi += trans.length;
        } catch(e) {}
      }
    }
  });

  const persentaseKeuangan = targetRKAD > 0 ? ((totalRealisasiKeuangan / targetRKAD) * 100).toFixed(1) : 0;
  const sisaKeuangan = Math.max(0, targetRKAD - totalRealisasiKeuangan);
  const sisaPersenKeuangan = targetRKAD > 0 ? ((sisaKeuangan / targetRKAD) * 100).toFixed(1) : '0.0';

  const donutDataKeuangan = [
    { name: t('unit.realization'), value: totalRealisasiKeuangan },
    { name: t('unit.remaining_target'), value: Math.max(0, targetRKAD - totalRealisasiKeuangan) }
  ];
  const donutColors = ['var(--chart-bar-primary)', 'var(--chart-grid)'];

  const chartData = useMemo(() => {
    const data = [];
    let today = new Date();
    if (approvedLaporan && approvedLaporan.length > 0) {
      const dates = approvedLaporan.map(l => new Date(l.tanggal).getTime());
      today = new Date(Math.max(...dates));
    }
    
    for (let i = chartDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const laporanHariIni = approvedLaporan?.filter(l => l.tanggal.startsWith(dateStr));
      
      let p = 0;
      let e = 0;
      laporanHariIni?.forEach(l => {
        if (l.laporan_keuangan) {
          p += l.laporan_keuangan.pendapatan ? parseFloat(l.laporan_keuangan.pendapatan) : 0;
          e += l.laporan_keuangan.pengeluaran ? parseFloat(l.laporan_keuangan.pengeluaran) : 0;
        }
      });
      data.push({
        name: formatDate(d, { day: 'numeric', month: 'short' }, lang),
        Pendapatan: p,
        Pengeluaran: e
      });
    }
    return data;
  }, [approvedLaporan, chartDays, lang]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
      
      {/* Box 1: Pendapatan, Pengeluaran, Laba Rugi */}
      <div className="card shadow-sm" style={{ padding: '24px', border: '2px solid #fb923c', borderRadius: '12px', backgroundColor: '#fff' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', textAlign: 'center' }}>
          <div style={{ borderRight: '1px solid var(--border)' }}>
            <p className="text-sm font-medium text-blue-900 mb-2">{t('keuangan.total_income')}</p>
            <h3 className="text-3xl font-bold text-green-600">{cur} {formatCompact(totalPendapatanKeuangan, lang, 2)}</h3>
          </div>
          <div style={{ borderRight: '1px solid var(--border)' }}>
            <p className="text-sm font-medium text-blue-900 mb-2">{t('keuangan.total_expense')}</p>
            <h3 className="text-3xl font-bold text-red-600">{cur} {formatCompact(totalPengeluaranKeuangan, lang, 2)}</h3>
          </div>
          <div>
            <p className="text-sm font-medium text-blue-900 mb-2">{t('keuangan.total_profit')}</p>
            <h3 className={`text-3xl font-bold ${totalLabaRugiKeuangan >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {cur} {formatCompact(Math.abs(totalLabaRugiKeuangan), lang, 2)}
            </h3>
          </div>
        </div>
      </div>

      {/* Box 2: Ringkasan SPJ, Invoice, Transaksi */}
      <div className="card shadow-sm" style={{ padding: '24px', border: '2px solid #6366f1', borderRadius: '12px', backgroundColor: '#fff' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', textAlign: 'center' }}>
          <div style={{ borderRight: '1px solid var(--border)' }}>
            <p className="text-sm font-medium text-blue-900 mb-1">{t('unit.trx_total')}</p>
            <p className="text-xs text-gray-400 mb-2">{t('unit.data_count', { count: countTransaksi })}</p>
            <h3 className="text-3xl font-bold text-blue-600">{cur} {formatCompact(totalPendapatanKeuangan + totalPengeluaranKeuangan, lang, 2)}</h3>
          </div>
          <div style={{ borderRight: '1px solid var(--border)' }}>
            <p className="text-sm font-medium text-blue-900 mb-1">{t('unit.spj_total')}</p>
            <p className="text-xs text-gray-400 mb-2">{t('unit.data_count', { count: countSPJ })}</p>
            <h3 className="text-3xl font-bold text-purple-600">{cur} {formatCompact(totalSPJ, lang, 2)}</h3>
          </div>
          <div>
            <p className="text-sm font-medium text-blue-900 mb-1">{t('unit.invoice_total')}</p>
            <p className="text-xs text-gray-400 mb-2">{countInvoiceBelumLunas > 0 ? <span className="text-red-500 font-bold">{countInvoiceBelumLunas} {t('unit.unpaid')}</span> : <span className="text-green-500">{t('unit.all_paid')}</span>}</p>
            <h3 className="text-3xl font-bold text-orange-600">{cur} {formatCompact(totalInvoice, lang, 2)}</h3>
          </div>
        </div>
      </div>

      {/* 2 Column Layout for Trend and Donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* Left: Trend Line Chart */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 className="font-semibold text-lg m-0 text-gray-800">{t('keuangan.cashflow_trend')}</h3>
            <select value={chartDays} onChange={(e) => setChartDays(parseInt(e.target.value))} className="form-control" style={{ width: 'auto', padding: '4px 12px', height: 'auto' }}>
              <option value={7}>{t('dashboard.last_7_days')}</option>
              <option value={14}>{t('dashboard.last_14_days')}</option>
              <option value={30}>{t('dashboard.last_30_days')}</option>
            </select>
          </div>
          <div style={{ height: '320px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="name" stroke="var(--chart-axis)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(val) => `${cur} ${formatCompact(val, lang)}`} width={80} stroke="var(--chart-axis)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => `${cur} ${formatNumber(value, lang)}`} cursor={{ stroke: 'var(--chart-grid)', strokeWidth: 1 }} contentStyle={{ backgroundColor: 'var(--chart-card)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }} itemStyle={{ color: 'var(--text-primary)', fontWeight: '500' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', color: 'var(--text-secondary)' }} />
                <Line type="monotone" dataKey="Pendapatan" name={t('unit.income')} stroke="var(--chart-line-blue)" strokeWidth={3} activeDot={{ r: 6, fill: 'var(--chart-line-blue)', stroke: '#fff', strokeWidth: 2 }} dot={{ r: 4, fill: 'var(--chart-line-blue)', strokeWidth: 0 }} />
                <Line type="monotone" dataKey="Pengeluaran" name={t('keuangan.total_expense')} stroke="var(--chart-line-orange)" strokeWidth={3} activeDot={{ r: 6, fill: 'var(--chart-line-orange)', stroke: '#fff', strokeWidth: 2 }} dot={{ r: 4, fill: 'var(--chart-line-orange)', strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Donut Chart for RKAD */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h3 className="font-semibold text-lg m-0 text-gray-800 mb-4">{t('unit.rkad_title')}</h3>
          {!hasMasterTarget && (
            <p className="text-xs mb-4" style={{ color: 'var(--warning)' }}>{t('dashboard.target_missing')}</p>
          )}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={donutDataKeuangan} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={2} dataKey="value" stroke="none">
                    {donutDataKeuangan.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={donutColors[index]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', maxWidth: '70%' }}>
              <h2 className="font-bold" style={{ color: 'var(--brand-500)', margin: 0, lineHeight: 1.1, overflowWrap: 'anywhere', fontSize: String(persentaseKeuangan).length > 7 ? '18px' : String(persentaseKeuangan).length > 5 ? '22px' : '30px' }}>{persentaseKeuangan}%</h2>
              <p className="text-xs text-muted">{t('unit.realization')}</p>
            </div>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ textAlign: 'center', flex: 1, minWidth: 0, borderRight: '1px solid var(--border)', padding: '0 4px' }}>
              <p className="text-xs text-muted mb-1">{t('unit.total_realization')}</p>
              <p className="font-semibold text-gray-800" style={{ fontSize: '13px', overflowWrap: 'anywhere' }}>{cur} {formatCompact(totalRealisasiKeuangan, lang, 2)}</p>
            </div>
            <div style={{ textAlign: 'center', flex: 1, minWidth: 0, borderRight: '1px solid var(--border)', padding: '0 4px' }}>
              <p className="text-xs text-muted mb-1">{t('unit.rkad_target')}</p>
              <p className="font-semibold text-gray-800" style={{ fontSize: '13px', overflowWrap: 'anywhere' }}>{cur} {formatCompact(targetRKAD, lang, 2)}</p>
            </div>
            <div style={{ textAlign: 'center', flex: 1, minWidth: 0, padding: '0 4px' }}>
              <p className="text-xs text-muted mb-1">{t('dashboard.remaining')} ({sisaPersenKeuangan}%)</p>
              <p className="font-semibold text-gray-800" style={{ fontSize: '13px', overflowWrap: 'anywhere' }}>{cur} {formatCompact(sisaKeuangan, lang, 2)}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardKeuangan;
