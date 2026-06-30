import React from 'react';

const ReviewKNA = ({ laporan_kna }) => {
  return (
    <div className="card mb-4">
      <h3 className="section-title">Data Harian KNA</h3>
      
      <h4 className="font-bold text-sm text-primary mb-2 mt-4">1. RKAD</h4>
      <div className="table-wrapper mb-4">
        <table>
          <thead>
            <tr>
              <th>Target (Rp)</th>
              <th>Realisasi (Rp)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-lg">Rp {(laporan_kna.target_rkad || 0).toLocaleString('id-ID')}</td>
              <td className="text-lg">Rp {(laporan_kna.realisasi_rkad || 0).toLocaleString('id-ID')}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h4 className="font-bold text-sm text-primary mb-2 mt-4">2. Kontrak ROW</h4>
      <div className="table-wrapper mb-4">
        <table>
          <thead>
            <tr>
              <th>Jumlah Kontrak</th>
              <th>Luas T (m²)</th>
              <th>Luas B (m²)</th>
              <th>Nilai (Rp)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-lg font-medium">{laporan_kna.jml_kontrak_row || 0}</td>
              <td className="text-lg">{(laporan_kna.luas_t_row || 0).toLocaleString('id-ID')}</td>
              <td className="text-lg">{(laporan_kna.luas_b_row || 0).toLocaleString('id-ID')}</td>
              <td className="text-lg text-brand-500 font-bold">Rp {(laporan_kna.nilai_row || 0).toLocaleString('id-ID')}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h4 className="font-bold text-sm text-primary mb-2 mt-4">3. Kontrak Non-ROW</h4>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Jumlah Kontrak</th>
              <th>Luas T (m²)</th>
              <th>Luas B (m²)</th>
              <th>Nilai (Rp)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-lg font-medium">{laporan_kna.jml_kontrak_non_row || 0}</td>
              <td className="text-lg">{(laporan_kna.luas_t_non_row || 0).toLocaleString('id-ID')}</td>
              <td className="text-lg">{(laporan_kna.luas_b_non_row || 0).toLocaleString('id-ID')}</td>
              <td className="text-lg text-brand-500 font-bold">Rp {(laporan_kna.nilai_non_row || 0).toLocaleString('id-ID')}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReviewKNA;
