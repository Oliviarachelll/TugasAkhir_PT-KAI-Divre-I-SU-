import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import FormattedNumberInput from './FormattedNumberInput';
import { KA_PENUMPANG_LIST } from '../../../data/kaPenumpang';
import { formatNumber, currencyPrefix } from '../../../utils/format';

const FormPenumpang = ({ draftLaporan, setDraft }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const cur = currencyPrefix(lang);
  const [filterKa, setFilterKa] = useState('SRILELAWANGSA');

  // Initialize Penumpang Items
  useEffect(() => {
    let items = draftLaporan.penumpangItems || [];
    if (items.length === 0) {
      items = KA_PENUMPANG_LIST.map(ka => ({
        nama_ka: ka.nama_ka,
        no_ka: ka.no_ka,
        lintas: ka.lintas,
        berangkat: ka.berangkat,
        kedatangan: ka.kedatangan || '',
        jml_penumpang: '',
        pendapatan: 0
      }));
      setDraft({ penumpangItems: items });
    }
  }, [draftLaporan.penumpangItems, setDraft]);

  const items = draftLaporan.penumpangItems || [];

  const handleAddKeretaBaru = () => {
    const newName = window.prompt(t('validation.enter_train'));
    if (!newName) return;
    setDraft({
      penumpangItems: [
        ...items,
        { nama_ka: newName.toUpperCase(), no_ka: '', lintas: '', berangkat: '', kedatangan: '', jml_penumpang: '', pendapatan: 0, isCustom: true }
      ]
    });
    setFilterKa(newName.toUpperCase());
  };

  const handleAddJadwal = () => {
    setDraft({
      penumpangItems: [
        ...items,
        { nama_ka: filterKa, no_ka: '', lintas: '', berangkat: '', kedatangan: '', jml_penumpang: '', pendapatan: 0, isCustom: true }
      ]
    });
  };

  const handleChangePenumpang = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setDraft({ penumpangItems: newItems });
  };

  const handleRemovePenumpang = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    setDraft({ penumpangItems: newItems });
  };

  // Dynamically calculate KA_NAMES_FILTER
  const uniqueKaNames = Array.from(new Set(items.map(i => i.nama_ka)));
  const DEFAULT_KA_NAMES = [
    'SRILELAWANGSA', 'SRIBILAH UTAMA', 'DATUK BELAMBANGAN',
    'PUTRI DELI', 'SIANTAR EKSPRES', 'AMIR HAMZAH', 'NURMALA', 'CUT MUTIA'
  ];
  const KA_NAMES_FILTER = Array.from(new Set([...DEFAULT_KA_NAMES, ...uniqueKaNames]));

  const filteredItems = items.map((item, originalIndex) => ({ ...item, originalIndex }))
                             .filter(item => item.nama_ka === filterKa);

  const totalPenumpangFilter = filteredItems.reduce((sum, item) => sum + (parseInt(item.jml_penumpang) || 0), 0);

  return (
    <div className="card mb-4" style={{ marginBottom: '24px' }}>
      <h3 className="section-title">{t('laporan.form.pnp_title')}</h3>

      {/* Filter & Action */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <label className="form-label">{t('laporan.form.pnp_choose')}</label>
          <select className="form-control" value={filterKa} onChange={(e) => setFilterKa(e.target.value)}>
            {KA_NAMES_FILTER.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div style={{ marginTop: '24px' }}>
          <button className="btn btn-primary" onClick={handleAddKeretaBaru}>
            {t('laporan.form.pnp_add_train')}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper mb-4">
        <table>
          <thead>
            <tr>
              <th>{t('laporan.form.pnp_th_no')}</th>
              <th>{t('laporan.form.pnp_th_route')}</th>
              <th>{t('laporan.form.pnp_th_depart')}</th>
              <th>{t('laporan.form.pnp_th_arrive')}</th>
              <th style={{ width: '150px' }}>{t('laporan.form.pnp_th_total')} <span className="text-danger">*</span></th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.originalIndex}>
                <td>
                  {item.isCustom ? (
                    <input type="text" className="form-control form-control-sm" placeholder={t('laporan.form.pnp_no_ph')} value={item.no_ka || ''} onChange={(e) => handleChangePenumpang(item.originalIndex, 'no_ka', e.target.value)} />
                  ) : (
                    <span className="font-medium">{item.no_ka}</span>
                  )}
                </td>
                <td>
                  {item.isCustom ? (
                    <input type="text" className="form-control form-control-sm" placeholder={t('laporan.form.pnp_route_ph')} value={item.lintas || ''} onChange={(e) => handleChangePenumpang(item.originalIndex, 'lintas', e.target.value)} />
                  ) : (
                    <span className="text-muted">{item.lintas}</span>
                  )}
                </td>
                <td>
                  {item.isCustom ? (
                    <input type="time" className="form-control form-control-sm" value={item.berangkat || ''} onChange={(e) => handleChangePenumpang(item.originalIndex, 'berangkat', e.target.value)} />
                  ) : (
                    <span className="text-muted">{item.berangkat}</span>
                  )}
                </td>
                <td>
                  {item.isCustom ? (
                    <input type="time" className="form-control form-control-sm" value={item.kedatangan || ''} onChange={(e) => handleChangePenumpang(item.originalIndex, 'kedatangan', e.target.value)} />
                  ) : (
                    <span className="text-muted">{item.kedatangan}</span>
                  )}
                </td>
                <td>
                  <FormattedNumberInput className="form-control form-control-sm" placeholder="0" value={item.jml_penumpang} onChange={(val) => handleChangePenumpang(item.originalIndex, 'jml_penumpang', val)} />
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted py-4">{t('laporan.form.pnp_empty')}</td>
              </tr>
            )}
          </tbody>
        </table>
        
        {/* Add Jadwal Button below table */}
        <div style={{ marginTop: '12px', padding: '0 16px' }}>
          <button className="btn btn-outline-primary btn-sm" onClick={handleAddJadwal}>
            {t('laporan.form.pnp_add_schedule', { ka: filterKa })}
          </button>
        </div>
      </div>

      {/* SUMMARY BAWAH */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '32px' }}>
        <div className="p-4 bg-input border border-border rounded">
          <label className="form-label text-muted mb-1">{t('laporan.form.pnp_total_pax', { ka: filterKa })}</label>
          <div className="text-2xl font-bold text-gray-800">{formatNumber(totalPenumpangFilter, lang)} <span className="text-sm font-normal">{t('dashboard.people')}</span></div>
        </div>
        <div className="p-4 bg-input border border-border rounded">
          <label className="form-label text-muted mb-1">{t('laporan.form.pnp_total_income', { ka: filterKa })}</label>
          <FormattedNumberInput 
            className="form-control font-bold text-success" 
            placeholder="0" 
            prefix={cur}
            value={draftLaporan.pendapatanKa?.[filterKa] || ''} 
            onChange={(val) => {
              setDraft({
                pendapatanKa: {
                  ...(draftLaporan.pendapatanKa || {}),
                  [filterKa]: val
                }
              });
            }} 
          />
        </div>
      </div>
    </div>
  );
};

export default FormPenumpang;
