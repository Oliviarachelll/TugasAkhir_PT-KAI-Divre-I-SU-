import React from 'react';

const ReviewPenumpang = ({ laporan_penumpang }) => {
  return (
    <div className="card mb-4">
      <h3 className="section-title">Data Harian Penumpang</h3>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nama KA</th>
              <th>Jumlah Penumpang</th>
              <th>Pendapatan (Rp)</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(
              laporan_penumpang.reduce((acc, curr) => {
                if (!acc[curr.nama_ka]) acc[curr.nama_ka] = { nama_ka: curr.nama_ka, jml_penumpang: 0, pendapatan: 0 };
                acc[curr.nama_ka].jml_penumpang += curr.jml_penumpang;
                acc[curr.nama_ka].pendapatan += parseFloat(curr.pendapatan || 0);
                return acc;
              }, {})
            ).map((item, i) => (
              <tr key={i}>
                <td className="font-medium">{item.nama_ka || '-'}</td>
                <td>{item.jml_penumpang ? item.jml_penumpang.toLocaleString('id-ID') : 0}</td>
                <td className="text-success font-bold">Rp {item.pendapatan ? item.pendapatan.toLocaleString('id-ID') : 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReviewPenumpang;
