import React, { useEffect, useMemo } from 'react';
import FormattedNumberInput from './FormattedNumberInput';
import TableRincianTransaksi from './TableRincianTransaksi';
import TableSPJ from './TableSPJ';
import TableInvoice from './TableInvoice';

const FormKeuangan = ({ draftLaporan, setDraft }) => {
  const targetRkad = draftLaporan.keuangan?.target_rkad || '';
  const realisasiRkad = draftLaporan.keuangan?.realisasi_rkad || '';
  
  const rincianTransaksi = draftLaporan.keuangan?.rincian_transaksi || '[]';
  const rincianSPJ = draftLaporan.keuangan?.rincian_spj || '[]';
  const rincianInvoice = draftLaporan.keuangan?.rincian_invoice || '[]';

  // Parse transaksi to calculate totals
  const parsedTransaksi = useMemo(() => {
    try { return JSON.parse(rincianTransaksi) || []; } catch { return []; }
  }, [rincianTransaksi]);

  const computedPendapatan = parsedTransaksi.reduce((acc, curr) => acc + (parseFloat(curr.penerimaan) || 0), 0);
  const computedPengeluaran = parsedTransaksi.reduce((acc, curr) => acc + (parseFloat(curr.pengeluaran) || 0), 0);
  const labaRugi = computedPendapatan - computedPengeluaran;

  const handleChangeKeuangan = (field, value) => {
    setDraft(prev => {
      const newKeuangan = {
        ...(prev.keuangan || {}),
        [field]: value
      };
      
      // If we are updating rincian_transaksi, we should also update the totals immediately
      if (field === 'rincian_transaksi') {
        try {
          const trans = JSON.parse(value) || [];
          const pend = trans.reduce((acc, curr) => acc + (parseFloat(curr.penerimaan) || 0), 0);
          const peng = trans.reduce((acc, curr) => acc + (parseFloat(curr.pengeluaran) || 0), 0);
          newKeuangan.pendapatan = pend.toString();
          newKeuangan.pengeluaran = peng.toString();
        } catch(e) {}
      }

      return {
        ...prev,
        keuangan: newKeuangan
      };
    });
  };

  return (
    <div className="card mb-4" style={{ marginBottom: '24px' }}>
      <h3 className="section-title">Laporan Keuangan</h3>
      
      <div className="form-grid-2 mb-6">
        <div className="form-group">
          <label className="form-label">Target RKAD (Rp)</label>
          <FormattedNumberInput className="form-control" placeholder="0" value={targetRkad} onChange={(val) => handleChangeKeuangan('target_rkad', val)} />
        </div>
        <div className="form-group">
          <label className="form-label">Realisasi RKAD (Rp)</label>
          <FormattedNumberInput className="form-control" placeholder="0" value={realisasiRkad} onChange={(val) => handleChangeKeuangan('realisasi_rkad', val)} />
        </div>
      </div>

      <TableRincianTransaksi 
        data={rincianTransaksi} 
        onChange={(val) => handleChangeKeuangan('rincian_transaksi', val)} 
      />

      <TableSPJ 
        data={rincianSPJ} 
        onChange={(val) => handleChangeKeuangan('rincian_spj', val)} 
      />

      <TableInvoice 
        data={rincianInvoice} 
        onChange={(val) => handleChangeKeuangan('rincian_invoice', val)} 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div className="form-group p-4 rounded bg-gray-50 border border-gray-200">
          <label className="form-label mb-1">Total Pendapatan (Otomatis)</label>
          <p className="text-xl font-bold text-green-700">
            Rp {computedPendapatan.toLocaleString('id-ID')}
          </p>
        </div>
        <div className="form-group p-4 rounded bg-gray-50 border border-gray-200">
          <label className="form-label mb-1">Total Pengeluaran (Otomatis)</label>
          <p className="text-xl font-bold text-red-700">
            Rp {computedPengeluaran.toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      <div className="form-group mt-6 p-6 rounded-lg bg-white border-2 border-orange-400 flex flex-col md:flex-row justify-between items-center shadow-sm">
        <div>
          <h4 className="text-sm font-bold text-blue-900 mb-2 uppercase tracking-wide">HASIL (LABA / RUGI)</h4>
          <p className={`text-md mb-1 font-medium ${labaRugi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {labaRugi >= 0 ? 'Untung (Laba)' : 'Rugi'}
          </p>
          <p className={`text-3xl font-bold ${labaRugi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            Rp {Math.abs(labaRugi).toLocaleString('id-ID')}
          </p>
        </div>
        <div className="mt-4 md:mt-0 text-left md:text-right">
          <p className="text-sm text-blue-900 mb-1 font-medium">Penerimaan - Pengeluaran</p>
          <p className="text-md text-blue-900 mb-1">
            {computedPendapatan.toLocaleString('id-ID')} - {computedPengeluaran.toLocaleString('id-ID')}
          </p>
          <p className={`text-lg font-bold ${labaRugi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            = {labaRugi >= 0 ? '' : '-'}{Math.abs(labaRugi).toLocaleString('id-ID')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default FormKeuangan;
