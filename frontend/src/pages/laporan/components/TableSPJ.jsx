import React, { useState } from 'react';
import FormattedNumberInput from './FormattedNumberInput';
import { Plus } from 'lucide-react';

const TableSPJ = ({ data, onChange }) => {
  const [items, setItems] = useState(() => {
    if (typeof data === 'string') {
      try { return JSON.parse(data) || []; } catch { return []; }
    }
    return Array.isArray(data) ? data : [];
  });

  const [form, setForm] = useState({ id: null, no_spj: '', tanggal_spj: '', uraian: '', nominal: '', keterangan: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleSave = () => {
    if (!form.no_spj || !form.uraian) return alert('No SPJ dan Uraian wajib diisi');
    
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
    setForm({ id: null, no_spj: '', tanggal_spj: '', uraian: '', nominal: '', keterangan: '' });
    setIsEditing(false);
    setShowForm(false);
  };

  const handleEdit = (item) => {
    setForm(item);
    setIsEditing(true);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Hapus baris ini?')) {
      const newItems = items.filter(item => item.id !== id);
      setItems(newItems);
      onChange(JSON.stringify(newItems));
    }
  };

  const totalNominal = items.reduce((acc, curr) => acc + (parseFloat(curr.nominal) || 0), 0);

  return (
    <div className="card mb-6" style={{ padding: '24px' }}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="section-title m-0 uppercase font-bold text-gray-800">INPUT SPJ</h3>
        <button 
          className="btn btn-primary flex items-center gap-2 bg-blue-600 text-white"
          onClick={() => { setForm({ id: null, no_spj: '', tanggal_spj: '', uraian: '', nominal: '', keterangan: '' }); setIsEditing(false); setShowForm(!showForm); }}
        >
          <Plus className="w-4 h-4" /> {isEditing ? 'Batal Edit' : 'Tambah SPJ'}
        </button>
      </div>

      {showForm && (
        <div className="bg-blue-50 p-4 rounded mb-4 border border-blue-100">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div className="form-group">
              <label className="form-label">No. SPJ</label>
              <input type="text" className="form-control" value={form.no_spj} onChange={e => setForm({...form, no_spj: e.target.value})} placeholder="Contoh: SPJ-0702-001" />
            </div>
            <div className="form-group">
              <label className="form-label">Tanggal SPJ</label>
              <input type="date" className="form-control" value={form.tanggal_spj} onChange={e => setForm({...form, tanggal_spj: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Uraian</label>
              <input type="text" className="form-control" value={form.uraian} onChange={e => setForm({...form, uraian: e.target.value})} placeholder="Uraian kegiatan" />
            </div>
            <div className="form-group">
              <label className="form-label">Nominal (Rp)</label>
              <FormattedNumberInput className="form-control" value={form.nominal} onChange={val => setForm({...form, nominal: val})} />
            </div>
            <div className="form-group md:col-span-2">
              <label className="form-label">Keterangan Tambahan (opsional)</label>
              <input type="text" className="form-control" value={form.keterangan} onChange={e => setForm({...form, keterangan: e.target.value})} placeholder="Keterangan..." />
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleSave}>Simpan SPJ</button>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%', minWidth: '800px' }}>
          <thead>
            <tr>
              <th className="text-center">No</th>
              <th>No. SPJ</th>
              <th>Tanggal SPJ</th>
              <th>Uraian</th>
              <th className="text-right">Nominal (Rp)</th>
              <th>Keterangan Tambahan</th>
              <th className="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan="7" className="text-center text-muted">Belum ada SPJ</td></tr>
            ) : items.map((item, index) => (
              <tr key={item.id}>
                <td className="text-center">{index + 1}</td>
                <td>{item.no_spj}</td>
                <td>{item.tanggal_spj ? new Date(item.tanggal_spj).toLocaleDateString('id-ID') : '-'}</td>
                <td>{item.uraian}</td>
                <td className="text-right">{parseFloat(item.nominal || 0).toLocaleString('id-ID')}</td>
                <td>
                  {item.keterangan ? (
                    <span className="px-3 py-1 rounded text-sm bg-gray-100 border text-gray-700">
                      {item.keterangan}
                    </span>
                  ) : '-'}
                </td>
                <td className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => handleEdit(item)} className="p-1 hover:bg-gray-100 rounded text-blue-600 border border-blue-100 bg-blue-50" title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-1 hover:bg-red-50 rounded text-red-600 border border-red-100" title="Hapus">
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
                <td colSpan="4" className="text-left pl-6 py-4">TOTAL SPJ</td>
                <td className="text-right text-gray-800">{totalNominal.toLocaleString('id-ID')}</td>
                <td colSpan="2"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default TableSPJ;
