import React, { useState, useEffect } from 'react';
import { Edit2, PowerOff, Power, Send, AlertCircle, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { waCloudApi } from '../../api/waCloud.api';


const NotifikasiPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [messageType, setMessageType] = useState('template');
  const [messageText, setMessageText] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateBody, setNewTemplateBody] = useState('');
  const [newTemplateTrigger, setNewTemplateTrigger] = useState('MANUAL');
  const [newTemplateUnit, setNewTemplateUnit] = useState('SEMUA');
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);

  const [templates, setTemplates] = useState([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const fetchTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const response = await waCloudApi.getTemplates();
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Gagal mengambil data template dari Meta');
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const response = await waCloudApi.getLogs();
      setLogs(response.data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchLogs();
  }, []);

  const handleBroadcast = async (e) => {
    e.preventDefault();

    if (messageType === 'text' && !messageText.trim()) {
      toast.error('Isi pesan teks tidak boleh kosong');
      return;
    }

    if (messageType === 'template' && !templateName.trim()) {
      toast.error('Nama template tidak boleh kosong');
      return;
    }

    setIsSubmitting(true);
    try {
      // Cari bahasa template yang dipilih agar sesuai dengan Meta
      let templateLanguage = 'id';
      if (messageType === 'template') {
        const selectedTemplate = templates.find(t => t.name === templateName);
        if (selectedTemplate) {
          templateLanguage = selectedTemplate.language;
        }
      }

      const response = await waCloudApi.sendBroadcast({
        messageType,
        messageText,
        templateName,
        templateLanguage
      });
      
      const successCount = response.results?.success?.length || 0;
      const failedCount = response.results?.failed?.length || 0;
      
      toast.success(`Broadcast selesai: ${successCount} Berhasil, ${failedCount} Gagal`);
      
      setIsModalOpen(false);
      setMessageText('');
      setTemplateName('');
      fetchLogs(); // Reload logs after sending
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Terjadi kesalahan saat mengirim broadcast');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!newTemplateName || !newTemplateBody) {
      toast.error('Nama dan isi template wajib diisi');
      return;
    }

    setIsCreatingTemplate(true);
    try {
      const response = await waCloudApi.createTemplate({
        name: newTemplateName,
        body: newTemplateBody,
        trigger: newTemplateTrigger,
        unit: newTemplateUnit
      });
      toast.success(response.message || 'Template berhasil dibuat');
      
      // Optimistic update agar langsung tampil di tabel tanpa menunggu jeda cache Meta
      setTemplates(prev => [
        {
          id: response.data?.id || Date.now().toString(),
          name: newTemplateName.toLowerCase().replace(/\s+/g, '_'),
          status: 'PENDING',
          trigger_waktu: newTemplateTrigger,
          unit_penerima: newTemplateUnit
        },
        ...prev
      ]);

      setIsTemplateModalOpen(false);
      setNewTemplateName('');
      setNewTemplateBody('');
      setNewTemplateTrigger('MANUAL');
      setNewTemplateUnit('SEMUA');
      
      // Tetap fetch di-background untuk sinkronisasi, meski mungkin butuh 30dtk dari Meta
      fetchTemplates();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Terjadi kesalahan saat membuat template');
    } finally {
      setIsCreatingTemplate(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="text-sm text-muted font-medium mb-1">Manajemen <span className="mx-1">&gt;</span> <span className="text-primary">Manajemen Notifikasi</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <p className="text-muted text-sm mb-1 font-medium">Total Template Aktif</p>
          <h3 className="text-3xl font-bold">
            {isLoadingTemplates ? '-' : templates.filter(t => t.status === 'APPROVED').length}
          </h3>
        </div>
        <div className="card" style={{ padding: '16px 20px' }}>
          <p className="text-muted text-sm mb-1 font-medium">Notifikasi Terkirim (Hari Ini)</p>
          <h3 className="text-3xl font-bold">1</h3>
        </div>
        <div className="card" style={{ padding: '16px 20px' }}>
          <p className="text-muted text-sm mb-1 font-medium">Notifikasi Gagal</p>
          <h3 className="text-3xl font-bold">0</h3>
        </div>
        <div className="card" style={{ padding: '16px 20px' }}>
          <p className="text-muted text-sm mb-1 font-medium">Unit Belum Lapor</p>
          <h3 className="text-3xl font-bold">0</h3>
        </div>
      </div>

      <div className="card p-0 mb-6" style={{ padding: 0, marginBottom: '24px' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 className="font-bold text-lg m-0">Template Notifikasi & Broadcast</h3>
          <div className="flex gap-3">
            <button 
              onClick={fetchTemplates}
              disabled={isLoadingTemplates}
              className="btn btn-secondary btn-sm flex items-center gap-2" 
              style={{ backgroundColor: 'var(--bg-card-2)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              <Loader2 size={14} className={isLoadingTemplates ? 'animate-spin' : ''} /> Refresh
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="btn btn-sm flex items-center gap-2" 
              style={{ backgroundColor: '#2563eb', color: '#fff', padding: '6px 16px', borderRadius: '6px', fontWeight: '500' }}
            >
              <Send size={14} /> Broadcast Sekarang
            </button>
            <button 
              onClick={() => setIsTemplateModalOpen(true)}
              className="btn btn-secondary btn-sm" 
              style={{ backgroundColor: '#cbd5e1', color: '#1e293b', border: '1px solid #94a3b8' }}
            >
              + Buat Template Baru
            </button>
          </div>
        </div>
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>NAMA TEMPLATE</th>
                <th>TRIGGER</th>
                <th>PENERIMA</th>
                <th>STATUS</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingTemplates ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                    <Loader2 className="animate-spin mx-auto" style={{ color: 'var(--accent-blue)' }} size={24} />
                  </td>
                </tr>
              ) : templates.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Tidak ada template</td>
                </tr>
              ) : templates.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{t.name}</td>
                  <td>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '12px', 
                      backgroundColor: 'var(--bg-card-2)',
                      border: '1px solid var(--border)'
                    }}>
                      {t.trigger_waktu || 'MANUAL'}
                    </span>
                  </td>
                  <td>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '12px', 
                      backgroundColor: 'var(--bg-card-2)',
                      border: '1px solid var(--border)'
                    }}>
                      {t.unit_penerima || 'SEMUA'}
                    </span>
                  </td>
                  <td>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '12px', 
                      fontWeight: 'bold',
                      backgroundColor: t.status === 'APPROVED' ? 'var(--success-bg)' : (t.status === 'REJECTED' ? 'var(--danger-bg)' : 'var(--warning-bg)'),
                      color: t.status === 'APPROVED' ? 'var(--success)' : (t.status === 'REJECTED' ? 'var(--danger)' : 'var(--warning)'),
                      border: `1px solid ${t.status === 'APPROVED' ? 'var(--success-border)' : (t.status === 'REJECTED' ? 'var(--danger-border)' : 'var(--warning-border)')}`
                    }}>
                      {t.status}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary btn-sm flex items-center gap-1" style={{ padding: '4px 8px' }}>
                      <Edit2 size={14} /> Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-0" style={{ padding: 0 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h3 className="font-bold text-lg m-0">Log Pengiriman Terbaru</h3>
        </div>
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>WAKTU</th>
                <th>TEMPLATE</th>
                <th>PENERIMA</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingLogs ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>
                    <Loader2 className="animate-spin mx-auto" style={{ color: 'var(--accent-blue)' }} size={20} />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Belum ada riwayat pengiriman</td>
                </tr>
              ) : logs.map((l, i) => (
                <tr key={i}>
                  <td>{new Date(l.waktu).toLocaleString('id-ID')}</td>
                  <td>{l.template}</td>
                  <td>{l.penerima}</td>
                  <td>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '12px', 
                      fontWeight: '500',
                      backgroundColor: 'var(--bg-card-2)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)'
                    }}>
                      {l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Broadcast Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="rounded-xl shadow-xl w-full max-w-lg overflow-hidden border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="px-6 py-4 border-b flex justify-between items-center" style={{ backgroundColor: 'var(--bg-card-2)', borderColor: 'var(--border)' }}>
              <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Send className="text-blue-600" size={18} />
                Kirim WA Broadcast
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="transition-colors rounded-full p-1.5" style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleBroadcast} className="p-6 space-y-5">
              <div className="bg-blue-50/80 border border-blue-200/60 rounded-lg p-3.5 text-sm flex gap-3 shadow-sm" style={{ color: 'var(--accent-blue)' }}>
                <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                <p className="leading-relaxed">Pesan ini akan dikirimkan secara otomatis ke <strong>seluruh nomor HP unit</strong> yang telah terdaftar di database.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2.5" style={{ color: 'var(--text-secondary)' }}>Jenis Pesan</label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="radio" 
                      name="messageType" 
                      value="template" 
                      checked={messageType === 'template'}
                      onChange={() => setMessageType('template')}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Template Meta <span className="text-xs font-normal ml-1" style={{ color: 'var(--text-muted)' }}>(Rekomendasi)</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="radio" 
                      name="messageType" 
                      value="text" 
                      checked={messageType === 'text'}
                      onChange={() => setMessageType('text')}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Teks Bebas <span className="text-xs font-normal ml-1" style={{ color: 'var(--text-muted)' }}>(Batas 24j)</span></span>
                  </label>
                </div>
              </div>

              {messageType === 'text' ? (
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Teks Pesan</label>
                  <textarea
                    className="form-control"
                    rows="4"
                    placeholder="Halo! Ini pesan pengingat..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Pilih Template Meta</label>
                  <select
                    className="form-control"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    required
                  >
                    <option value="">-- Pilih Template yang Disetujui --</option>
                    {templates.filter(t => t.status === 'APPROVED').map(t => (
                      <option key={t.id} value={t.name}>{t.name} ({t.language})</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>Hanya template yang berstatus APPROVED yang dapat digunakan.</p>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t mt-6" style={{ borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary disabled:opacity-70 flex items-center gap-2"
                >
                  {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Mengirim...</> : <><Send size={16} /> Kirim Sekarang</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Template Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="rounded-xl shadow-xl w-full max-w-lg overflow-hidden border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="px-6 py-4 border-b flex justify-between items-center" style={{ backgroundColor: 'var(--bg-card-2)', borderColor: 'var(--border)' }}>
              <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Edit2 className="text-blue-600" size={18} />
                Buat Template Baru
              </h3>
              <button onClick={() => setIsTemplateModalOpen(false)} className="transition-colors rounded-full p-1.5" style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreateTemplate} className="p-6 space-y-5">
              <div className="bg-blue-50/80 border border-blue-200/60 rounded-lg p-3.5 text-sm flex gap-3 shadow-sm" style={{ color: 'var(--accent-blue)' }}>
                <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                <p className="leading-relaxed">Template baru akan dikirimkan ke Meta untuk ditinjau. Proses persetujuan umumnya memakan waktu 1-2 menit. Format akan diset menjadi <b>UTILITY</b>.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Nama Template</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Contoh: pengingat_laporan_bulanan"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                />
                <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>Gunakan huruf kecil dan garis bawah (_) tanpa spasi.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Isi Pesan Template</label>
                <textarea
                  className="form-control"
                  rows="5"
                  placeholder="Ketik isi pesan di sini..."
                  value={newTemplateBody}
                  onChange={(e) => setNewTemplateBody(e.target.value)}
                />
                <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>Gunakan variabel &#123;&#123;1&#125;&#125; jika diperlukan (namun backend harus disesuaikan untuk mengisinya).</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Waktu Trigger Otomatis</label>
                  <select
                    className="form-control"
                    value={newTemplateTrigger}
                    onChange={(e) => setNewTemplateTrigger(e.target.value)}
                  >
                    <option value="MANUAL">Manual (Kirim Sendiri)</option>
                    <option value="H_MIN_1">H-1 Deadline</option>
                    <option value="H_MIN_3">H-3 Deadline</option>
                    <option value="MINGGUAN">Mingguan</option>
                    <option value="BULANAN">Bulanan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Unit Penerima</label>
                  <select
                    className="form-control"
                    value={newTemplateUnit}
                    onChange={(e) => setNewTemplateUnit(e.target.value)}
                  >
                    <option value="SEMUA">Semua Unit</option>
                    <option value="PUSAT">Pusat</option>
                    <option value="DAERAH">Daerah</option>
                    <option value="CABANG">Cabang</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t mt-6" style={{ borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTemplate}
                  className="btn btn-primary disabled:opacity-70 flex items-center gap-2"
                >
                  {isCreatingTemplate ? <><Loader2 size={16} className="animate-spin" /> Menyimpan...</> : <><Send size={16} /> Buat Template</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotifikasiPage;
