import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import FormattedNumberInput from './FormattedNumberInput';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { formatNumber, formatDate, currencyPrefix } from '../../../utils/format';

const TableInvoice = ({ data, onChange }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const cur = currencyPrefix(lang);
  const [items, setItems] = useState(() => {
    if (typeof data === 'string') {
      try { return JSON.parse(data) || []; } catch { return []; }
    }
    return Array.isArray(data) ? data : [];
  });

  const [form, setForm] = useState({ id: null, no_invoice: '', tanggal_invoice: '', vendor: '', nominal: '', jatuh_tempo: '', status: 'Belum Lunas', keterangan: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleSave = () => {
    if (!form.no_invoice || !form.vendor) { toast.error(t('laporan.table.inv_required')); return; }
    
    let newItems = [...items];
    const newItem = {
      ...form,
      id: form.id || Date.now().toString(),
      nominal: form.nominal || '0',
    };

    if (isEditing) {
      newItems = newItems.map(item => item.id === newItem.id ? newItem : item);
    } else {
      newItems.push(newItem);
    }

    setItems(newItems);
    onChange(JSON.stringify(newItems));
    setForm({ id: null, no_invoice: '', tanggal_invoice: '', vendor: '', nominal: '', jatuh_tempo: '', status: 'Belum Lunas', keterangan: '' });
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

  const totalNominal = items.reduce((acc, curr) => acc + (parseFloat(curr.nominal) || 0), 0);

  return (
    <div className="card mb-6" style={{ padding: '24px' }}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="section-title m-0 uppercase font-bold text-gray-800">{t('laporan.table.inv_title')}</h3>
        <button 
          className="btn btn-primary flex items-center gap-2 bg-blue-600 text-white"
          onClick={() => { setForm({ id: null, no_invoice: '', tanggal_invoice: '', vendor: '', nominal: '', jatuh_tempo: '', status: 'Belum Lunas', keterangan: '' }); setIsEditing(false); setShowForm(!showForm); }}
        >
          <Plus className="w-4 h-4" /> {isEditing ? t('laporan.table.spj_cancel_edit') : t('laporan.table.inv_add')}
        </button>
      </div>

      {showForm && (
        <div className="bg-blue-50 p-4 rounded mb-4 border border-blue-100">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div className="form-group">
              <label className="form-label">{t('laporan.table.inv_no')}</label>
              <input type="text" className="form-control" value={form.no_invoice} onChange={e => setForm({...form, no_invoice: e.target.value})} placeholder={t('laporan.table.inv_no_ph')} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('laporan.table.inv_date')}</label>
              <input type="date" className="form-control" value={form.tanggal_invoice} onChange={e => setForm({...form, tanggal_invoice: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('laporan.table.inv_vendor')}</label>
              <input type="text" className="form-control" value={form.vendor} onChange={e => setForm({...form, vendor: e.target.value})} placeholder={t('laporan.table.inv_vendor_ph')} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('laporan.table.inv_nominal')} ({cur})</label>
              <FormattedNumberInput className="form-control" prefix={cur} value={form.nominal} onChange={val => setForm({...form, nominal: val})} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('laporan.table.inv_due')}</label>
              <input type="date" className="form-control" value={form.jatuh_tempo} onChange={e => setForm({...form, jatuh_tempo: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('laporan.table.inv_status')}</label>
              <select className="form-control" value={form.status || 'Belum Lunas'} onChange={e => setForm({...form, status: e.target.value})}>
                <option value="Belum Lunas">{t('laporan.table.inv_unpaid')}</option>
                <option value="Lunas">{t('laporan.table.inv_paid')}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('laporan.table.inv_note')}</label>
              <input type="text" className="form-control" value={form.keterangan} onChange={e => setForm({...form, keterangan: e.target.value})} placeholder={t('laporan.table.inv_note_ph')} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleSave}>{t('laporan.table.inv_save')}</button>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%', minWidth: '800px' }}>
          <thead>
            <tr>
              <th className="text-center">{t('laporan.table.inv_th_no')}</th>
              <th>{t('laporan.table.inv_no')}</th>
              <th>{t('laporan.table.inv_date')}</th>
              <th>{t('laporan.table.inv_vendor')}</th>
              <th className="text-right">{t('laporan.table.inv_nominal')} ({cur})</th>
              <th>{t('laporan.table.inv_due')}</th>
              <th>{t('laporan.table.inv_status')}</th>
              <th>{t('laporan.table.inv_note_col')}</th>
              <th className="text-center">{t('common.action')}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan="9" className="text-center text-muted">{t('laporan.table.inv_empty')}</td></tr>
            ) : items.map((item, index) => (
              <tr key={item.id}>
                <td className="text-center">{index + 1}</td>
                <td>{item.no_invoice}</td>
                <td>{item.tanggal_invoice ? formatDate(item.tanggal_invoice, undefined, lang) : '-'}</td>
                <td>{item.vendor}</td>
                <td className="text-right">{formatNumber(parseFloat(item.nominal || 0), lang)}</td>
                <td>{item.jatuh_tempo ? formatDate(item.jatuh_tempo, undefined, lang) : '-'}</td>
                <td>
                  <span className={`px-2 py-1 rounded text-xs ${item.status === 'Lunas' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                    {item.status === 'Lunas' ? t('laporan.table.inv_paid') : t('laporan.table.inv_unpaid')}
                  </span>
                </td>
                <td>
                  {item.keterangan ? (
                    <span className="px-3 py-1 rounded text-sm bg-gray-100 border text-gray-700">
                      {item.keterangan}
                    </span>
                  ) : '-'}
                </td>
                <td className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => handleEdit(item)} className="p-1 hover:bg-gray-100 rounded text-blue-600 border border-blue-100 bg-blue-50" title={t('laporan.table.edit')}>
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-1 hover:bg-red-50 rounded text-red-600 border border-red-100" title={t('laporan.table.delete')}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="font-bold bg-gray-50 border-t-2 border-gray-200">
                <td colSpan="4" className="text-left pl-6 py-4">{t('laporan.table.inv_total')}</td>
                <td className="text-right text-gray-800">{formatNumber(totalNominal, lang)}</td>
                <td colSpan="4"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default TableInvoice;
