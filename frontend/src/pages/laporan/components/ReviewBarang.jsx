import React from 'react';

const ReviewBarang = ({ laporan_barang }) => {
  return (
    <div className="card mb-4">
      <h3 className="section-title">Data Harian Barang</h3>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Komoditi</th>
              <th>Jml KA</th>
              <th>Harian Vol</th>
              <th>Kumulatif Vol</th>
              <th>Program Vol</th>
              <th>Harian Pendapatan</th>
              <th>Kumulatif Pendapatan</th>
              <th>Program Pendapatan</th>
            </tr>
          </thead>
          <tbody>
            {laporan_barang.filter(item => item.id_komoditi !== 99).map((item, i) => (
              <tr key={i}>
                <td>
                  {item.komoditi?.nama_komoditi || 'N/A'}
                  {item.nama_kustom ? ` - ${item.nama_kustom}` : ''}
                </td>
                <td>{item.jml_ka || 0}</td>
                <td>{item.volume ? parseFloat(item.volume).toLocaleString('id-ID') : 0} {item.komoditi?.satuan || ''}</td>
                <td>{item.volume_kumulatif ? parseFloat(item.volume_kumulatif).toLocaleString('id-ID') : 0} {item.komoditi?.satuan || ''}</td>
                <td>{item.volume_program ? parseFloat(item.volume_program).toLocaleString('id-ID') : 0} {item.komoditi?.satuan || ''}</td>
                <td>Rp {item.pendapatan ? parseFloat(item.pendapatan).toLocaleString('id-ID') : 0}</td>
                <td>Rp {item.pendapatan_kumulatif ? parseFloat(item.pendapatan_kumulatif).toLocaleString('id-ID') : 0}</td>
                <td>Rp {item.pendapatan_program ? parseFloat(item.pendapatan_program).toLocaleString('id-ID') : 0}</td>
              </tr>
            ))}
            {/* Tampilkan Total di baris terakhir jika ada */}
            {laporan_barang.filter(item => item.id_komoditi === 99).map((totalItem, i) => (
              <tr key={`total-${i}`} style={{ backgroundColor: 'var(--bg-main)', fontWeight: 'bold' }}>
                <td colSpan="2" className="text-center">TOTAL ANGKUTAN BARANG</td>
                <td>{totalItem.volume ? parseFloat(totalItem.volume).toLocaleString('id-ID') : 0} Ton</td>
                <td>{totalItem.volume_kumulatif ? parseFloat(totalItem.volume_kumulatif).toLocaleString('id-ID') : 0} Ton</td>
                <td>{totalItem.volume_program ? parseFloat(totalItem.volume_program).toLocaleString('id-ID') : 0} Ton</td>
                <td className="text-success">Rp {totalItem.pendapatan ? parseFloat(totalItem.pendapatan).toLocaleString('id-ID') : 0}</td>
                <td className="text-success">Rp {totalItem.pendapatan_kumulatif ? parseFloat(totalItem.pendapatan_kumulatif).toLocaleString('id-ID') : 0}</td>
                <td className="text-success">Rp {totalItem.pendapatan_program ? parseFloat(totalItem.pendapatan_program).toLocaleString('id-ID') : 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReviewBarang;
