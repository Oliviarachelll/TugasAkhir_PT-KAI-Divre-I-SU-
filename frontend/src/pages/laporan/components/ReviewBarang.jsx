import React from 'react';

const ReviewBarang = ({ laporan_barang }) => {
  const rincianItems = laporan_barang.filter(item => item.id_komoditi !== 99);
  let totalItem = laporan_barang.find(item => item.id_komoditi === 99);
  if (!totalItem && rincianItems.length > 0) {
    let autoVolume = 0;
    let autoPendapatan = 0;
    rincianItems.forEach(b => {
      autoVolume += parseFloat(b.volume) || 0;
      autoPendapatan += parseFloat(b.pendapatan) || 0;
    });
    totalItem = { volume: autoVolume, pendapatan: autoPendapatan };
  }

  // Hitung total Jml KA dari rincian
  const totalJmlKa = rincianItems.reduce((acc, curr) => acc + (parseInt(curr.jml_ka) || 0), 0);

  return (
    <div className="card mb-4">
      <h3 className="section-title">Data Harian Barang</h3>
      
      {/* SECTION 1: Total KA, VOL, & PENDAPATAN */}
      <div className="mb-6">
        <h4 className="font-semibold text-sm mb-3 text-slate-700 dark:text-slate-300">
          Total KA, VOL, & PENDAPATAN
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '16px' }} className="md:grid-cols-1 lg:grid-cols-4">
          
          {/* Left: Jml KA per Komoditi */}
          <div className="table-wrapper lg:col-span-1">
            <table className="text-sm">
              <thead>
                <tr>
                  <th>Komoditi</th>
                  <th className="text-center">Jml KA</th>
                </tr>
              </thead>
              <tbody>
                {rincianItems.map((item, i) => (
                  <tr key={i}>
                    <td>
                      {item.komoditi?.nama_komoditi || 'N/A'}
                      {item.nama_kustom ? ` - ${item.nama_kustom}` : ''}
                    </td>
                    <td className="text-center font-medium">
                      {item.jml_ka || 0} {item.id_komoditi === 15 ? 'B' : 'KA'}
                    </td>
                  </tr>
                ))}
                <tr style={{ backgroundColor: 'var(--bg-main)', fontWeight: 'bold' }}>
                  <td>TOTAL</td>
                  <td className="text-center text-primary">{totalJmlKa} KA</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Right: Total Volume & Pendapatan */}
          {totalItem && (
            <div className="table-wrapper lg:col-span-3">
              <table className="text-sm">
                <thead>
                  <tr>
                    <th>Total</th>
                    <th>Harian</th>
                    <th>Kumulatif</th>
                    <th>Program</th>
                    <th>Penc. (%)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-semibold text-slate-600">Volume</td>
                    <td className="font-medium">{totalItem.volume ? parseFloat(totalItem.volume).toLocaleString('id-ID') : 0} Ton</td>
                    <td className="font-medium">{totalItem.volume_kumulatif ? parseFloat(totalItem.volume_kumulatif).toLocaleString('id-ID') : 0} Ton</td>
                    <td className="font-medium">{totalItem.volume_program ? parseFloat(totalItem.volume_program).toLocaleString('id-ID') : 0} Ton</td>
                    <td className="font-medium text-info">{totalItem.volume_pencapaian ? parseFloat(totalItem.volume_pencapaian).toLocaleString('id-ID') : 0} %</td>
                  </tr>
                  <tr>
                    <td className="font-semibold text-slate-600">Pendapatan</td>
                    <td className="text-success font-medium">Rp {totalItem.pendapatan ? parseFloat(totalItem.pendapatan).toLocaleString('id-ID') : 0}</td>
                    <td className="text-success font-medium">Rp {totalItem.pendapatan_kumulatif ? parseFloat(totalItem.pendapatan_kumulatif).toLocaleString('id-ID') : 0}</td>
                    <td className="text-success font-medium">Rp {totalItem.pendapatan_program ? parseFloat(totalItem.pendapatan_program).toLocaleString('id-ID') : 0}</td>
                    <td className="text-info font-medium">{totalItem.pendapatan_pencapaian ? parseFloat(totalItem.pendapatan_pencapaian).toLocaleString('id-ID') : 0} %</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: Rincian Barang (Without Jml KA) */}
      <div>
        <h4 className="font-semibold text-sm mb-3 text-slate-700 dark:text-slate-300">Rincian Komoditi Barang</h4>
        <div className="table-wrapper">
          <table className="text-xs">
            <thead>
              <tr>
                <th>Komoditi</th>
                <th>Hari Vol</th>
                <th>Kum Vol</th>
                <th>Prog Vol</th>
                <th>Penc (%)</th>
                <th>Hari Pdt</th>
                <th>Kum Pdt</th>
                <th>Prog Pdt</th>
                <th>Penc (%)</th>
              </tr>
            </thead>
            <tbody>
              {rincianItems.map((item, i) => (
                <tr key={i}>
                  <td className="font-medium">
                    {item.komoditi?.nama_komoditi || 'N/A'}
                    {item.nama_kustom ? ` - ${item.nama_kustom}` : ''}
                  </td>
                  <td>{item.volume ? parseFloat(item.volume).toLocaleString('id-ID') : 0} Ton</td>
                  <td>{item.volume_kumulatif ? parseFloat(item.volume_kumulatif).toLocaleString('id-ID') : 0} Ton</td>
                  <td>{item.volume_program ? parseFloat(item.volume_program).toLocaleString('id-ID') : 0} Ton</td>
                  <td className="text-info font-medium">{item.volume_pencapaian ? parseFloat(item.volume_pencapaian).toLocaleString('id-ID') : 0}%</td>
                  <td className="text-success">Rp {item.pendapatan ? parseFloat(item.pendapatan).toLocaleString('id-ID') : 0}</td>
                  <td className="text-success">Rp {item.pendapatan_kumulatif ? parseFloat(item.pendapatan_kumulatif).toLocaleString('id-ID') : 0}</td>
                  <td className="text-success">Rp {item.pendapatan_program ? parseFloat(item.pendapatan_program).toLocaleString('id-ID') : 0}</td>
                  <td className="text-info font-medium">{item.pendapatan_pencapaian ? parseFloat(item.pendapatan_pencapaian).toLocaleString('id-ID') : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReviewBarang;
