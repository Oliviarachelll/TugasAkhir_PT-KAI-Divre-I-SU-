import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import FormattedNumberInput from './FormattedNumberInput';

const FormBarang = ({ draftLaporan, setDraft }) => {
  const [activeBarangTab, setActiveBarangTab] = useState(0);

  const items = draftLaporan.barangItems || [];
  const total = draftLaporan.barangTotal || {};

  if (items.length === 0) return null;

  const currentYear = draftLaporan.tanggal ? new Date(draftLaporan.tanggal).getFullYear() : new Date().getFullYear();
  const activeItem = items[activeBarangTab];

  const handleAddBarang = () => {
    setDraft({
      barangItems: [
        ...items,
        { id_komoditi: 98, nama_kustom: '', jml_ka: '', volume: '', volume_kumulatif: '', volume_program: '', volume_pencapaian: '', pendapatan: '', pendapatan_kumulatif: '', pendapatan_program: '', pendapatan_pencapaian: '' }
      ]
    });
    setActiveBarangTab(items.length);
  };

  const handleRemoveBarang = (indexToRemove) => {
    if (indexToRemove <= 5) return;
    const itemToRemove = items[indexToRemove];
    const newItems = items.filter((_, i) => i !== indexToRemove);
    
    const deletedItems = [...(draftLaporan.deletedBarangItems || [])];
    if (itemToRemove.id_laporan_barang) {
      deletedItems.push(itemToRemove.id_laporan_barang);
    }

    setDraft({ 
      barangItems: newItems,
      deletedBarangItems: deletedItems 
    });
    if (activeBarangTab >= indexToRemove) {
      setActiveBarangTab(Math.max(0, indexToRemove - 1));
    }
  };

  const handleChangeBarang = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setDraft({ barangItems: newItems });
  };

  const handleChangeBarangTotal = (field, value) => {
    const newTotal = { ...total };
    newTotal[field] = value;
    setDraft({ barangTotal: newTotal });
  };

  return (
    <div className="mb-6">
      {/* Bagian Atas: TOTAL */}
      <div className="card mb-4" style={{ marginBottom: '24px' }}>
        <h3 className="section-title">Total KA, VOL, & PENDAPATAN ANGKUTAN BARANG</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
          
          {/* Kiri: Input KA */}
          <div style={{ borderRight: '1px solid var(--border)', paddingRight: '24px' }}>
            <h4 className="font-semibold mb-3 text-sm">Jumlah KA per Komoditi</h4>
            {items.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                <label style={{ width: '120px', fontSize: '13px' }}>
                  {item.id_komoditi === 10 ? 'KA Petikemas' :
                   item.id_komoditi === 11 ? 'KA CPO' :
                   item.id_komoditi === 12 ? 'KA BBM' :
                   item.id_komoditi === 13 ? 'KA Palm Kernel' :
                   item.id_komoditi === 14 ? 'KA Lateks' :
                   item.id_komoditi === 15 ? 'KA BHP' :
                   (item.nama_kustom ? `KA ${item.nama_kustom}` : `Additional KA ${i - 5}`)}
                </label>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FormattedNumberInput 
                    className="form-control form-control-sm" 
                    placeholder="0" 
                    value={item.jml_ka} 
                    onChange={(val) => handleChangeBarang(i, 'jml_ka', val)} 
                  />
                  <span style={{ fontSize: '12px', whiteSpace: 'nowrap', width: '20px', display: 'inline-block' }}>
                    {item.id_komoditi === 15 ? 'B' : 'KA'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Kanan: Input Manual Total */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Volume Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 className="font-semibold text-sm">Volume</h4>
              <div className="form-group">
                <label className="text-xs text-muted mb-1 block">Harian Volume <span className="text-danger">*</span></label>
                <FormattedNumberInput className="form-control" placeholder="0" value={total.volume} onChange={(val) => handleChangeBarangTotal('volume', val)} suffix="Ton" />
              </div>
              <div className="form-group">
                <label className="text-xs text-muted mb-1 block">Kumulatif {currentYear}</label>
                <FormattedNumberInput className="form-control" placeholder="0" value={total.volume_kumulatif} onChange={(val) => handleChangeBarangTotal('volume_kumulatif', val)} suffix="Ton" />
              </div>
              <div className="form-group">
                <label className="text-xs text-muted mb-1 block">Program {currentYear}</label>
                <FormattedNumberInput className="form-control" placeholder="0" value={total.volume_program} onChange={(val) => handleChangeBarangTotal('volume_program', val)} suffix="Ton" />
              </div>
              <div className="form-group">
                <label className="text-xs text-muted mb-1 block">Pencapaian</label>
                <FormattedNumberInput className="form-control" placeholder="0" value={total.volume_pencapaian} onChange={(val) => handleChangeBarangTotal('volume_pencapaian', val)} suffix="%" />
              </div>
            </div>

            {/* Pendapatan Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 className="font-semibold text-sm">Pendapatan</h4>
              <div className="form-group">
                <label className="text-xs text-muted mb-1 block">Harian Pendapatan <span className="text-danger">*</span></label>
                <FormattedNumberInput className="form-control" placeholder="0" value={total.pendapatan} onChange={(val) => handleChangeBarangTotal('pendapatan', val)} prefix="Rp" />
              </div>
              <div className="form-group">
                <label className="text-xs text-muted mb-1 block">Kumulatif {currentYear}</label>
                <FormattedNumberInput className="form-control" placeholder="0" value={total.pendapatan_kumulatif} onChange={(val) => handleChangeBarangTotal('pendapatan_kumulatif', val)} prefix="Rp" />
              </div>
              <div className="form-group">
                <label className="text-xs text-muted mb-1 block">Program {currentYear}</label>
                <FormattedNumberInput className="form-control" placeholder="0" value={total.pendapatan_program} onChange={(val) => handleChangeBarangTotal('pendapatan_program', val)} prefix="Rp" />
              </div>
              <div className="form-group">
                <label className="text-xs text-muted mb-1 block">Pencapaian</label>
                <FormattedNumberInput className="form-control" placeholder="0" value={total.pendapatan_pencapaian} onChange={(val) => handleChangeBarangTotal('pendapatan_pencapaian', val)} suffix="%" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bagian Bawah: RINCIAN BARANG */}
      <div className="card">
        <h3 className="section-title">Rincian Barang</h3>
        
        {/* Tabs Menu */}
        <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '2px solid var(--border)', marginBottom: '20px', gap: '8px' }}>
          {items.map((item, index) => {
            const label = item.id_komoditi === 10 ? 'PETI KEMAS' :
                          item.id_komoditi === 11 ? 'CPO' :
                          item.id_komoditi === 12 ? 'BBM' :
                          item.id_komoditi === 13 ? 'PALM KERNEL' :
                          item.id_komoditi === 14 ? 'LATEKS' :
                          item.id_komoditi === 15 ? 'BHP' :
                          (item.nama_kustom ? item.nama_kustom.toUpperCase() : `ADDITIONAL ${index - 5}`);
            
            const isActive = activeBarangTab === index;
            return (
              <button 
                key={index}
                className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: '8px 8px 0 0', borderBottom: isActive ? 'none' : '' }}
                onClick={() => setActiveBarangTab(index)}
              >
                {label}
              </button>
            );
          })}
          <button className="btn btn-sm text-primary" onClick={handleAddBarang} style={{ border: '1px dashed var(--primary)', borderRadius: '8px 8px 0 0' }}>
            + ADD OPTIONAL
          </button>
        </div>

        {/* Form Content for Active Tab */}
        {activeItem && (
          <div style={{ minHeight: '400px' }}>
            {/* Jika ini komoditi custom, tampilkan input nama_kustom */}
            {activeBarangTab > 5 && (
               <div className="mb-4 flex items-end gap-3">
                 <div style={{ flex: 1 }}>
                   <label className="form-label">Nama Komoditi Kustom</label>
                   <input 
                     type="text" 
                     className="form-control" 
                     value={activeItem.nama_kustom || ''} 
                     onChange={(e) => handleChangeBarang(activeBarangTab, 'nama_kustom', e.target.value)}
                     placeholder="Contoh: Batu Bara, Semen, dll"
                   />
                 </div>
                 <button 
                   className="btn btn-outline-danger" 
                   onClick={() => handleRemoveBarang(activeBarangTab)}
                   title="Hapus komoditi ini"
                   style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem 1rem' }}
                 >
                   <Trash2 size={16} /> Hapus
                 </button>
               </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
              {/* Volume Details */}
              <div>
                <h4 className="font-semibold mb-3">Volume</h4>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Harian Volume <span className="text-danger">*</span></label>
                    <FormattedNumberInput className="form-control" placeholder="0" value={activeItem.volume} onChange={(val) => handleChangeBarang(activeBarangTab, 'volume', val)} suffix="Ton" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Kumulatif Volume ({currentYear})</label>
                    <FormattedNumberInput className="form-control" placeholder="0" value={activeItem.volume_kumulatif} onChange={(val) => handleChangeBarang(activeBarangTab, 'volume_kumulatif', val)} suffix="Ton" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Program Volume ({currentYear})</label>
                    <FormattedNumberInput className="form-control" placeholder="0" value={activeItem.volume_program} onChange={(val) => handleChangeBarang(activeBarangTab, 'volume_program', val)} suffix="Ton" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Pencapaian Volume</label>
                    <FormattedNumberInput className="form-control" placeholder="0" value={activeItem.volume_pencapaian} onChange={(val) => handleChangeBarang(activeBarangTab, 'volume_pencapaian', val)} suffix="%" />
                  </div>
                </div>
              </div>

              {/* Pendapatan Details */}
              <div>
                <h4 className="font-semibold mb-3">Pendapatan</h4>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Harian Pendapatan <span className="text-danger">*</span></label>
                    <FormattedNumberInput className="form-control" placeholder="0" value={activeItem.pendapatan} onChange={(val) => handleChangeBarang(activeBarangTab, 'pendapatan', val)} prefix="Rp" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Kumulatif Pendapatan ({currentYear})</label>
                    <FormattedNumberInput className="form-control" placeholder="0" value={activeItem.pendapatan_kumulatif} onChange={(val) => handleChangeBarang(activeBarangTab, 'pendapatan_kumulatif', val)} prefix="Rp" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Program Pendapatan ({currentYear})</label>
                    <FormattedNumberInput className="form-control" placeholder="0" value={activeItem.pendapatan_program} onChange={(val) => handleChangeBarang(activeBarangTab, 'pendapatan_program', val)} prefix="Rp" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Pencapaian Pendapatan</label>
                    <FormattedNumberInput className="form-control" placeholder="0" value={activeItem.pendapatan_pencapaian} onChange={(val) => handleChangeBarang(activeBarangTab, 'pendapatan_pencapaian', val)} suffix="%" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FormBarang;
