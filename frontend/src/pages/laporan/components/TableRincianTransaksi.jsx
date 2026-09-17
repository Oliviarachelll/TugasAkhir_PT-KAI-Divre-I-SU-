import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import FormattedNumberInput from './FormattedNumberInput';
import { Plus } from 'lucide-react';
import { formatNumber, currencyPrefix } from '../../../utils/format';

const TableRincianTransaksi = ({ data, onChange }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const cur = currencyPrefix(lang);
  const [items, setItems] = useState(() => {
    if (typeof data === 'string') {
      try { return JSON.parse(data) || []; } catch { return []; }
    }
    return Array.isArray(data) ? data : [];
  });

  const [form, setForm] = useState({ id: null, jenis: 'Penerimaan', uraian: '', penerimaan: '', pengeluaran: '', unit_kerja: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleSave = () => {
    if (!form.uraian) { toast.error(t('laporan.table.trx_required')); return; }
    
    let newItems = [...items];
    const newItem = {
      ...form,
      id: form.id || Date.now().toString(),
      penerimaan: form.penerimaan || '0',
      pengeluaran: form.pengeluaran || '0'
    };

    if (isEditing) {
      newItems = newItems.map(item => item.id === newItem.id ? newItem : item);
    } else {
      newItems.push(newItem);
    }

    setItems(newItems);
    onChange(JSON.stringify(newItems));
    setForm({ id: null, jenis: 'Penerimaan', uraian: '', penerimaan: '', pengeluaran: '', unit_kerja: '' });
    setIsEditing(false);
    setShowForm(false);
  };

  const handleEdit = (item) => {
    setForm(item);
    setIsEditing(true);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm(t('validation.delete_row'))) {
      const newItems = items.filter(item => item.id !== id);
      setItems(newItems);
      onChange(JSON.stringify(newItems));
    }
  };

  const totalPenerimaan = items.reduce((acc, curr) => acc + (parseFloat(curr.penerimaan) || 0), 0);
  const totalPengeluaran = items.reduce((acc, curr) => acc + (parseFloat(curr.pengeluaran) || 0), 0);

  return (
    <div className="card mb-6" style={{ padding: '24px' }}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="section-title m-0 uppercase font-bold text-gray-800">{t('laporan.table.trx_title')}</h3>
        <button 
          className="btn btn-primary flex items-center gap-2"
          onClick={() => { setForm({ id: null, jenis: 'Penerimaan', uraian: '', penerimaan: '', pengeluaran: '', unit_kerja: '' }); setIsEditing(false); setShowForm(!showForm); }}
        >
          <Plus className="w-4 h-4" /> {isEditing ? t('laporan.table.spj_cancel_edit') : t('laporan.table.trx_add')}
        </button>
      </div>

      {showForm && (
        <div className="bg-blue-50 p-4 rounded mb-4 border border-blue-100">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div className="form-group">
              <label className="form-label">{t('laporan.table.trx_type')}</label>
              <select className="form-control" value={form.jenis} onChange={e => setForm({...form, jenis: e.target.value})}>
                <option value="Penerimaan">{t('laporan.table.trx_in')}</option>
                <option value="Pembayaran">{t('laporan.table.trx_out')}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('laporan.table.trx_desc')}</label>
              <input type="text" className="form-control" value={form.uraian} onChange={e => setForm({...form, uraian: e.target.value})} placeholder={t('laporan.table.trx_desc_ph')} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('laporan.table.trx_unit')}</label>
              <select className="form-control" value={form.unit_kerja} onChange={e => setForm({...form, unit_kerja: e.target.value})}>
                <option value="">{t('laporan.table.trx_unit_ph')}</option>
                <option value="KNA">KNA</option>
                <option value="Angkutan Barang">Angkutan Barang</option>
                <option value="Angkutan Penumpang">Angkutan Penumpang</option>
                <option value="Keuangan">Keuangan</option>
              </select>
            </div>
            {form.jenis === 'Penerimaan' && (
              <div className="form-group">
                <label className="form-label">{t('laporan.table.trx_income')} ({cur})</label>
                <FormattedNumberInput className="form-control" prefix={cur} value={form.penerimaan} onChange={val => setForm({...form, penerimaan: val})} />
              </div>
            )}
            {form.jenis === 'Pembayaran' && (
              <div className="form-group">
                <label className="form-label">{t('laporan.table.trx_expense')} ({cur})</label>
                <FormattedNumberInput className="form-control" prefix={cur} value={form.pengeluaran} onChange={val => setForm({...form, pengeluaran: val})} />
              </div>
            )}
          </div>
          <button className="btn btn-primary" onClick={handleSave}>{t('laporan.table.trx_save')}</button>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%', minWidth: '800px' }}>
          <thead>
            <tr>
              <th className="text-center">{t('laporan.table.trx_th_no')}</th>
              <th>{t('laporan.table.trx_type')}</th>
              <th>{t('laporan.table.trx_desc')}</th>
              <th className="text-right">{t('laporan.table.trx_income')} ({cur})</th>
              <th className="text-right">{t('laporan.table.trx_expense')} ({cur})</th>
              <th>{t('laporan.table.trx_unit')}</th>
              <th className="text-center">{t('common.action')}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan="7" className="text-center text-muted">{t('laporan.table.trx_empty')}</td></tr>
            ) : items.map((item, index) => (
              <tr key={item.id}>
                <td className="text-center">{index + 1}</td>
                <td>
                  <span className={`px-3 py-1 rounded text-sm bg-white border`}>
                    {item.jenis === 'Penerimaan' ? t('laporan.table.trx_in') : item.jenis === 'Pembayaran' ? t('laporan.table.trx_out') : item.jenis}
                  </span>
                </td>
                <td>{item.uraian}</td>
                <td className="text-right">{formatNumber(parseFloat(item.penerimaan || 0), lang)}</td>
                <td className="text-right">{formatNumber(parseFloat(item.pengeluaran || 0), lang)}</td>
                <td>
                   <span className={`px-3 py-1 rounded text-sm bg-white border`}>{item.unit_kerja}</span>
                </td>
                <td className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => handleEdit(item)} className="p-1 hover:bg-gray-100 rounded text-blue-600" title={t('laporan.table.edit')}>
                      ✏️
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-1 hover:bg-red-50 rounded text-red-600 border border-red-100" title={t('laporan.table.delete')}>
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="font-bold bg-gray-50 border-t-2 border-gray-200">
                <td colSpan="3" className="text-left pl-6 py-4">{t('laporan.table.trx_total')}</td>
                <td className="text-right text-gray-800">{formatNumber(totalPenerimaan, lang)}</td>
                <td className="text-right text-gray-800">{formatNumber(totalPengeluaran, lang)}</td>
                <td colSpan="2"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default TableRincianTransaksi;
