import React, { useMemo } from 'react';

const ReviewKeuangan = ({ laporan_keuangan }) => {
  const trans = useMemo(() => {
    try { return JSON.parse(laporan_keuangan.rincian_transaksi || '[]') || []; } catch { return []; }
  }, [laporan_keuangan.rincian_transaksi]);

  const spj = useMemo(() => {
    try { return JSON.parse(laporan_keuangan.rincian_spj || '[]') || []; } catch { return []; }
  }, [laporan_keuangan.rincian_spj]);

  const invoice = useMemo(() => {
    try { return JSON.parse(laporan_keuangan.rincian_invoice || '[]') || []; } catch { return []; }
  }, [laporan_keuangan.rincian_invoice]);

  const labaRugi = (parseFloat(laporan_keuangan.pendapatan) || 0) - (parseFloat(laporan_keuangan.pengeluaran) || 0);

  return (
    <div className="card mb-4" style={{ marginBottom: '24px' }}>
      <h3 className="section-title">Data Harian Keuangan</h3>
      
      <div className="table-wrapper mb-6">
        <table>
          <thead>
            <tr>
              <th>Target RKAD (Rp)</th>
              <th>Realisasi RKAD (Rp)</th>
              <th>Pendapatan (Rp)</th>
              <th>Pengeluaran (Rp)</th>
              <th>Laba / Rugi (Rp)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Rp {(laporan_keuangan.target_rkad || 0).toLocaleString('id-ID')}</td>
              <td>Rp {(laporan_keuangan.realisasi_rkad || 0).toLocaleString('id-ID')}</td>
              <td className="text-green-600 font-medium">Rp {(laporan_keuangan.pendapatan || 0).toLocaleString('id-ID')}</td>
              <td className="text-red-600 font-medium">Rp {(laporan_keuangan.pengeluaran || 0).toLocaleString('id-ID')}</td>
              <td className={`font-bold ${labaRugi >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                Rp {labaRugi.toLocaleString('id-ID')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {trans.length > 0 && (
        <div className="mb-6">
          <h4 className="font-bold text-gray-700 mb-2 text-sm uppercase">Rincian Transaksi</h4>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="text-center">No</th>
                  <th>Jenis</th>
                  <th>Uraian</th>
                  <th className="text-right">Penerimaan (Rp)</th>
                  <th className="text-right">Pengeluaran (Rp)</th>
                  <th>Unit Kerja</th>
                </tr>
              </thead>
              <tbody>
                {trans.map((t, i) => (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td>{t.jenis}</td>
                    <td>{t.uraian}</td>
                    <td className="text-right">{parseFloat(t.penerimaan || 0).toLocaleString('id-ID')}</td>
                    <td className="text-right">{parseFloat(t.pengeluaran || 0).toLocaleString('id-ID')}</td>
                    <td>{t.unit_kerja}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {spj.length > 0 && (
        <div className="mb-6">
          <h4 className="font-bold text-gray-700 mb-2 text-sm uppercase">Input SPJ</h4>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="text-center">No</th>
                  <th>No. SPJ</th>
                  <th>Tanggal</th>
                  <th>Uraian</th>
                  <th className="text-right">Nominal (Rp)</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {spj.map((s, i) => (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td>{s.no_spj}</td>
                    <td>{s.tanggal_spj ? new Date(s.tanggal_spj).toLocaleDateString('id-ID') : '-'}</td>
                    <td>{s.uraian}</td>
                    <td className="text-right">{parseFloat(s.nominal || 0).toLocaleString('id-ID')}</td>
                    <td>{s.keterangan || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {invoice.length > 0 && (
        <div>
          <h4 className="font-bold text-gray-700 mb-2 text-sm uppercase">Input Invoice</h4>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="text-center">No</th>
                  <th>No. Invoice</th>
                  <th>Tanggal</th>
                  <th>Vendor</th>
                  <th className="text-right">Nominal (Rp)</th>
                  <th>Jatuh Tempo</th>
                  <th>Status</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {invoice.map((inv, i) => (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td>{inv.no_invoice}</td>
                    <td>{inv.tanggal_invoice ? new Date(inv.tanggal_invoice).toLocaleDateString('id-ID') : '-'}</td>
                    <td>{inv.vendor}</td>
                    <td className="text-right">{parseFloat(inv.nominal || 0).toLocaleString('id-ID')}</td>
                    <td>{inv.jatuh_tempo ? new Date(inv.jatuh_tempo).toLocaleDateString('id-ID') : '-'}</td>
                    <td>{inv.status || 'Belum Lunas'}</td>
                    <td>{inv.keterangan || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default ReviewKeuangan;
