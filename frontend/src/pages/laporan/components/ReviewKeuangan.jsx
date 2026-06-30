import React from 'react';

const ReviewKeuangan = ({ laporan_keuangan }) => {
  return (
    <div className="card mb-4">
      <h3 className="section-title">Data Harian Keuangan</h3>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Pendapatan (Rp)</th>
              <th>Pengeluaran (Rp)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Rp {(laporan_keuangan.pendapatan || 0).toLocaleString('id-ID')}</td>
              <td>Rp {(laporan_keuangan.pengeluaran || 0).toLocaleString('id-ID')}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReviewKeuangan;
