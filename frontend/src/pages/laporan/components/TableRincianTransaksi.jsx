import React, { useState } from 'react';
import FormattedNumberInput from './FormattedNumberInput';
import { Plus } from 'lucide-react';

const TableRincianTransaksi = ({ data, onChange }) => {
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
    if (!form.uraian) return alert('Uraian wajib diisi');
    
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
    if (window.confirm('Hapus baris ini?')) {
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
        <h3 className="section-title m-0 uppercase font-bold text-gray-800">RINCIAN TRANSAKSI</h3>
        <button 
          className="btn btn-primary flex items-center gap-2"
          onClick={() => { setForm({ id: null, jenis: 'Penerimaan', uraian: '', penerimaan: '', pengeluaran: '', unit_kerja: '' }); setIsEditing(false); setShowForm(!showForm); }}
        >
          <Plus className="w-4 h-4" /> {isEditing ? 'Batal Edit' : 'Tambah Transaksi'}
        </button>
      </div>

      {showForm && (
        <div className="bg-blue-50 p-4 rounded mb-4 border border-blue-100">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div className="form-group">
              <label className="form-label">Jenis Transaksi</label>
              <select className="form-control" value={form.jenis} onChange={e => setForm({...form, jenis: e.target.value})}>
                <option value="Penerimaan">Penerimaan</option>
                <option value="Pembayaran">Pembayaran</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Uraian</label>
              <input type="text" className="form-control" value={form.uraian} onChange={e => setForm({...form, uraian: e.target.value})} placeholder="Uraian" />
            </div>
            <div className="form-group">
              <label className="form-label">Unit Kerja</label>
              <select className="form-control" value={form.unit_kerja} onChange={e => setForm({...form, unit_kerja: e.target.value})}>
                <option value="">-- Pilih Unit Kerja --</option>
                <option value="KNA">KNA</option>
                <option value="Angkutan Barang">Angkutan Barang</option>
                <option value="Angkutan Penumpang">Angkutan Penumpang</option>
                <option value="Keuangan">Keuangan</option>
              </select>
            </div>
            {form.jenis === 'Penerimaan' && (
              <div className="form-group">
                <label className="form-label">Penerimaan (Rp)</label>
                <FormattedNumberInput className="form-control" value={form.penerimaan} onChange={val => setForm({...form, penerimaan: val})} />
              </div>
            )}
            {form.jenis === 'Pembayaran' && (
              <div className="form-group">
                <label className="form-label">Pengeluaran (Rp)</label>
                <FormattedNumberInput className="form-control" value={form.pengeluaran} onChange={val => setForm({...form, pengeluaran: val})} />
              </div>
            )}
          </div>
          <button className="btn btn-primary" onClick={handleSave}>Simpan Baris</button>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%', minWidth: '800px' }}>
          <thead>
            <tr>
              <th className="text-center">No</th>
              <th>Jenis Transaksi</th>
              <th>Uraian</th>
              <th className="text-right">Penerimaan (Rp)</th>
              <th className="text-right">Pengeluaran (Rp)</th>
              <th>Unit Kerja</th>
              <th className="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan="7" className="text-center text-muted">Belum ada transaksi</td></tr>
            ) : items.map((item, index) => (
              <tr key={item.id}>
                <td className="text-center">{index + 1}</td>
                <td>
                  <span className={`px-3 py-1 rounded text-sm bg-white border`}>
                    {item.jenis}
                  </span>
                </td>
                <td>{item.uraian}</td>
                <td className="text-right">{parseFloat(item.penerimaan || 0).toLocaleString('id-ID')}</td>
                <td className="text-right">{parseFloat(item.pengeluaran || 0).toLocaleString('id-ID')}</td>
                <td>
                   <span className={`px-3 py-1 rounded text-sm bg-white border`}>{item.unit_kerja}</span>
                </td>
                <td className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => handleEdit(item)} className="p-1 hover:bg-gray-100 rounded text-blue-600" title="Edit">
                      ✏️
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-1 hover:bg-red-50 rounded text-red-600 border border-red-100" title="Hapus">
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
                <td colSpan="3" className="text-left pl-6 py-4">TOTAL</td>
                <td className="text-right text-gray-800">{totalPenerimaan.toLocaleString('id-ID')}</td>
                <td className="text-right text-gray-800">{totalPengeluaran.toLocaleString('id-ID')}</td>
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
