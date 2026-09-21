import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import FormattedNumberInput from './FormattedNumberInput';
import { currencyPrefix, formatNumber } from '../../../utils/format';

const toNumLocal = (v) => {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const ytdKeyFor = (item) => {
  if (!item) return '';
  return item.id_komoditi === 98
    ? `custom:${String(item.nama_kustom || '').toUpperCase()}`
    : String(item.id_komoditi);
};

const ytdLookup = (map, item) => map[ytdKeyFor(item)] || { volume: 0, pendapatan: 0 };

// Field read-only untuk angka otomatis (kumulatif & pencapaian).
const AutoField = ({ value, affix }) => (
  <div className="form-control bg-card-2 text-muted" style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span>{value}</span>
    {affix && <span style={{ color: '#9CA3AF', fontSize: '0.875rem' }}>{affix}</span>}
  </div>
);

const FormBarang = ({ draftLaporan, setDraft, ytdKomoditi = {}, programMaster = {} }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const cur = currencyPrefix(lang);
  const tonUnit = t('dashboard.ton');
  const [activeBarangTab, setActiveBarangTab] = useState(0);

  const items = draftLaporan.barangItems || [];
  const total = draftLaporan.barangTotal || {};
  const isNewDraft = !draftLaporan.id_laporan;

  // YTD per komoditi dari laporan DISETUJUI (s/d kemarin, exclude id 99).
  const ytdFor = (item) => ytdLookup(ytdKomoditi, item);
  const ytdTotalVol = Object.values(ytdKomoditi).reduce((s, v) => s + (v.volume || 0), 0);
  const ytdTotalPdt = Object.values(ytdKomoditi).reduce((s, v) => s + (v.pendapatan || 0), 0);

  // Kumulatif & pencapaian otomatis (TOTAL).
  const kumVolTotal = ytdTotalVol + toNumLocal(total.volume);
  const kumPdtTotal = ytdTotalPdt + toNumLocal(total.pendapatan);
  const pencVolTotal = toNumLocal(total.volume_program) > 0 ? Math.round((kumVolTotal / toNumLocal(total.volume_program)) * 1000) / 10 : 0;
  const pencPdtTotal = toNumLocal(total.pendapatan_program) > 0 ? Math.round((kumPdtTotal / toNumLocal(total.pendapatan_program)) * 1000) / 10 : 0;

  // Kumulatif & pencapaian otomatis (komoditi aktif).
  const activeItemEarly = items[activeBarangTab];
  const ytdActive = ytdFor(activeItemEarly);
  const kumVolItem = ytdActive.volume + toNumLocal(activeItemEarly?.volume);
  const kumPdtItem = ytdActive.pendapatan + toNumLocal(activeItemEarly?.pendapatan);
  const pencVolItem = activeItemEarly && toNumLocal(activeItemEarly.volume_program) > 0 ? Math.round((kumVolItem / toNumLocal(activeItemEarly.volume_program)) * 1000) / 10 : 0;
  const pencPdtItem = activeItemEarly && toNumLocal(activeItemEarly.pendapatan_program) > 0 ? Math.round((kumPdtItem / toNumLocal(activeItemEarly.pendapatan_program)) * 1000) / 10 : 0;

  // Tulis balik angka otomatis ke draft agar tersimpan & tampil di review.
  // Hanya menulis saat nilai berbeda agar tidak loop render.
  // Program per komoditi diambil dari master tahunan (diisi sekali di Target):
  // draft baru selalu ikut master, draft lama hanya bila masih kosong.
  // Komoditi custom (98) tetap manual. Program TOTAL = jumlah semua item.
  useEffect(() => {
    const numEq = (a, b) => Number(a) === Number(b);
    const isEmpty = (v) => v === '' || v === null || v === undefined;
    let itemsChanged = false;
    const newItems = items.map((item) => {
      const y = ytdLookup(ytdKomoditi, item);
      let volProg = item.volume_program;
      let pdtProg = item.pendapatan_program;
      if (item.id_komoditi !== 98) {
        const m = programMaster[String(item.id_komoditi)];
        if (m) {
          if (isNewDraft || isEmpty(volProg)) volProg = m.volume_program ?? (isNewDraft ? 0 : volProg);
          if (isNewDraft || isEmpty(pdtProg)) pdtProg = m.pendapatan_program ?? (isNewDraft ? 0 : pdtProg);
        } else if (isNewDraft) {
          if (isEmpty(volProg)) volProg = 0;
          if (isEmpty(pdtProg)) pdtProg = 0;
        }
      }
      const kv = y.volume + toNumLocal(item.volume);
      const kp = y.pendapatan + toNumLocal(item.pendapatan);
      const pv = toNumLocal(volProg) > 0 ? Math.round((kv / toNumLocal(volProg)) * 1000) / 10 : 0;
      const pp = toNumLocal(pdtProg) > 0 ? Math.round((kp / toNumLocal(pdtProg)) * 1000) / 10 : 0;
      if (!numEq(item.volume_program, volProg) || !numEq(item.pendapatan_program, pdtProg) ||
          !numEq(item.volume_kumulatif, kv) || !numEq(item.volume_pencapaian, pv) ||
          !numEq(item.pendapatan_kumulatif, kp) || !numEq(item.pendapatan_pencapaian, pp)) {
        itemsChanged = true;
        return { ...item, volume_program: volProg, pendapatan_program: pdtProg, volume_kumulatif: kv, volume_pencapaian: pv, pendapatan_kumulatif: kp, pendapatan_pencapaian: pp };
      }
      return item;
    });
    const sumVolProg = newItems.reduce((s, it) => s + toNumLocal(it.volume_program), 0);
    const sumPdtProg = newItems.reduce((s, it) => s + toNumLocal(it.pendapatan_program), 0);
    const patchTotal = {};
    if (!numEq(total.volume_program, sumVolProg)) patchTotal.volume_program = sumVolProg;
    if (!numEq(total.pendapatan_program, sumPdtProg)) patchTotal.pendapatan_program = sumPdtProg;
    if (!numEq(total.volume_kumulatif, kumVolTotal)) patchTotal.volume_kumulatif = kumVolTotal;
    if (!numEq(total.volume_pencapaian, pencVolTotal)) patchTotal.volume_pencapaian = pencVolTotal;
    if (!numEq(total.pendapatan_kumulatif, kumPdtTotal)) patchTotal.pendapatan_kumulatif = kumPdtTotal;
    if (!numEq(total.pendapatan_pencapaian, pencPdtTotal)) patchTotal.pendapatan_pencapaian = pencPdtTotal;
    if (Object.keys(patchTotal).length > 0 || itemsChanged) {
      setDraft({
        ...(Object.keys(patchTotal).length > 0 ? { barangTotal: { ...total, ...patchTotal } } : {}),
        ...(itemsChanged ? { barangItems: newItems } : {}),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, total, ytdKomoditi, kumVolTotal, kumPdtTotal, pencVolTotal, pencPdtTotal, programMaster, isNewDraft, setDraft]);

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
        <h3 className="section-title">{t('laporan.form.barang_total_title')}</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{t('laporan.form.barang_auto_hint')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
          
          {/* Kiri: Input KA */}
          <div style={{ borderRight: '1px solid var(--border)', paddingRight: '24px' }}>
            <h4 className="font-semibold mb-3 text-sm">{t('laporan.form.barang_ka_per_commodity')}</h4>
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
              <h4 className="font-semibold text-sm">{t('laporan.form.barang_volume')}</h4>
              <div className="form-group">
                <label className="text-xs text-muted mb-1 block">{t('laporan.form.barang_daily_volume')} <span className="text-danger">*</span></label>
                <FormattedNumberInput className="form-control" placeholder="0" value={total.volume} onChange={(val) => handleChangeBarangTotal('volume', val)} suffix={tonUnit} />
              </div>
              <div className="form-group">
                <label className="text-xs text-muted mb-1 block">{t('laporan.form.barang_cumulative', { year: currentYear })}</label>
                <AutoField value={formatNumber(kumVolTotal, lang)} affix={tonUnit} />
              </div>
              <div className="form-group">
                <label className="text-xs text-muted mb-1 block">{t('laporan.form.barang_program', { year: currentYear })}</label>
                <AutoField value={formatNumber(total.volume_program ?? 0, lang)} affix={tonUnit} />
              </div>
              <div className="form-group">
                <label className="text-xs text-muted mb-1 block">{t('laporan.form.barang_achievement')}</label>
                <AutoField value={formatNumber(pencVolTotal, lang)} affix="%" />
              </div>
            </div>

            {/* Pendapatan Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 className="font-semibold text-sm">{t('laporan.form.barang_income')}</h4>
              <div className="form-group">
                <label className="text-xs text-muted mb-1 block">{t('laporan.form.barang_daily_income')} <span className="text-danger">*</span></label>
                <FormattedNumberInput className="form-control" placeholder="0" value={total.pendapatan} onChange={(val) => handleChangeBarangTotal('pendapatan', val)} prefix={cur} />
              </div>
              <div className="form-group">
                <label className="text-xs text-muted mb-1 block">{t('laporan.form.barang_cumulative', { year: currentYear })}</label>
                <AutoField value={`${cur} ${formatNumber(kumPdtTotal, lang)}`} />
              </div>
              <div className="form-group">
                <label className="text-xs text-muted mb-1 block">{t('laporan.form.barang_program', { year: currentYear })}</label>
                <AutoField value={`${cur} ${formatNumber(total.pendapatan_program ?? 0, lang)}`} />
              </div>
              <div className="form-group">
                <label className="text-xs text-muted mb-1 block">{t('laporan.form.barang_achievement')}</label>
                <AutoField value={formatNumber(pencPdtTotal, lang)} affix="%" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bagian Bawah: RINCIAN BARANG */}
      <div className="card">
        <h3 className="section-title">{t('laporan.form.barang_detail_title')}</h3>
        
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
            {t('laporan.form.barang_add')}
          </button>
        </div>

        {/* Form Content for Active Tab */}
        {activeItem && (
          <div style={{ minHeight: '400px' }}>
            {activeItem.id_komoditi !== 98 && (
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{t('laporan.form.barang_program_hint')}</p>
            )}
            {/* Jika ini komoditi custom, tampilkan input nama_kustom */}
            {activeBarangTab > 5 && (
               <div className="mb-4 flex items-end gap-3">
                 <div style={{ flex: 1 }}>
                   <label className="form-label">{t('laporan.form.barang_custom_name')}</label>
                   <input 
                     type="text" 
                     className="form-control" 
                     value={activeItem.nama_kustom || ''} 
                     onChange={(e) => handleChangeBarang(activeBarangTab, 'nama_kustom', e.target.value)}
                     placeholder={t('laporan.form.barang_custom_ph')}
                   />
                 </div>
                 <button 
                   className="btn btn-outline-danger" 
                   onClick={() => handleRemoveBarang(activeBarangTab)}
                   title={t('laporan.form.barang_delete_title')}
                   style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem 1rem' }}
                 >
                   <Trash2 size={16} /> {t('laporan.form.barang_delete')}
                 </button>
               </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
              {/* Volume Details */}
              <div>
                <h4 className="font-semibold mb-3">{t('laporan.form.barang_volume')}</h4>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">{t('laporan.form.barang_vol_daily')} <span className="text-danger">*</span></label>
                    <FormattedNumberInput className="form-control" placeholder="0" value={activeItem.volume} onChange={(val) => handleChangeBarang(activeBarangTab, 'volume', val)} suffix={tonUnit} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">{t('laporan.form.barang_vol_cum', { year: currentYear })}</label>
                    <AutoField value={formatNumber(kumVolItem, lang)} affix={tonUnit} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">{t('laporan.form.barang_vol_prog', { year: currentYear })}</label>
                    {activeItem.id_komoditi === 98 ? (
                      <FormattedNumberInput className="form-control" placeholder="0" value={activeItem.volume_program} onChange={(val) => handleChangeBarang(activeBarangTab, 'volume_program', val)} suffix={tonUnit} />
                    ) : (
                      <AutoField value={formatNumber(activeItem.volume_program ?? 0, lang)} affix={tonUnit} />
                    )}
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">{t('laporan.form.barang_vol_ach')}</label>
                    <AutoField value={formatNumber(pencVolItem, lang)} affix="%" />
                  </div>
                </div>
              </div>

              {/* Pendapatan Details */}
              <div>
                <h4 className="font-semibold mb-3">{t('laporan.form.barang_income')}</h4>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">{t('laporan.form.barang_inc_daily')} <span className="text-danger">*</span></label>
                    <FormattedNumberInput className="form-control" placeholder="0" value={activeItem.pendapatan} onChange={(val) => handleChangeBarang(activeBarangTab, 'pendapatan', val)} prefix={cur} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">{t('laporan.form.barang_inc_cum', { year: currentYear })}</label>
                    <AutoField value={`${cur} ${formatNumber(kumPdtItem, lang)}`} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">{t('laporan.form.barang_inc_prog', { year: currentYear })}</label>
                    {activeItem.id_komoditi === 98 ? (
                      <FormattedNumberInput className="form-control" placeholder="0" value={activeItem.pendapatan_program} onChange={(val) => handleChangeBarang(activeBarangTab, 'pendapatan_program', val)} prefix={cur} />
                    ) : (
                      <AutoField value={`${cur} ${formatNumber(activeItem.pendapatan_program ?? 0, lang)}`} />
                    )}
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">{t('laporan.form.barang_inc_ach')}</label>
                    <AutoField value={formatNumber(pencPdtItem, lang)} affix="%" />
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
