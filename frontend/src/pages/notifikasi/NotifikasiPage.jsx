import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Edit2, PowerOff, Power, Send, AlertCircle, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { waCloudApi } from '../../api/waCloud.api';
import { API_ERROR_TOAST_ID } from '../../api/client';
import { formatDateTime } from '../../utils/format';


const NotifikasiPage = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
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
      toast.error(t('notifikasi.fetch_fail'), { id: API_ERROR_TOAST_ID });
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
      toast.error(t('notifikasi.text_required'));
      return;
    }

    if (messageType === 'template' && !templateName.trim()) {
      toast.error(t('notifikasi.template_required'));
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
      
      toast.success(t('notifikasi.broadcast_done', { s: successCount, f: failedCount }));
      
      setIsModalOpen(false);
      setMessageText('');
      setTemplateName('');
      fetchLogs(); // Reload logs after sending
    } catch (error) {
      toast.error(error?.response?.data?.error || t('notifikasi.send_fail'), { id: API_ERROR_TOAST_ID });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!newTemplateName || !newTemplateBody) {
      toast.error(t('notifikasi.form_required'));
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
      toast.success(response.message || t('notifikasi.create_success'));
      
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
      toast.error(error?.response?.data?.error || t('notifikasi.create_fail'), { id: API_ERROR_TOAST_ID });
    } finally {
      setIsCreatingTemplate(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="text-sm text-muted font-medium mb-1">{t('manajemen.title')} <span className="mx-1">&gt;</span> <span className="text-primary">{t('notifikasi.breadcrumb')}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <p className="text-muted text-sm mb-1 font-medium">{t('notifikasi.total_active')}</p>
          <h3 className="text-3xl font-bold">
            {isLoadingTemplates ? '-' : templates.filter(t => t.status === 'APPROVED').length}
          </h3>
        </div>
        <div className="card" style={{ padding: '16px 20px' }}>
          <p className="text-muted text-sm mb-1 font-medium">{t('notifikasi.sent_today')}</p>
          <h3 className="text-3xl font-bold">1</h3>
        </div>
        <div className="card" style={{ padding: '16px 20px' }}>
          <p className="text-muted text-sm mb-1 font-medium">{t('notifikasi.failed')}</p>
          <h3 className="text-3xl font-bold">0</h3>
        </div>
        <div className="card" style={{ padding: '16px 20px' }}>
          <p className="text-muted text-sm mb-1 font-medium">{t('notifikasi.pending_units')}</p>
          <h3 className="text-3xl font-bold">0</h3>
        </div>
      </div>

      <div className="card p-0 mb-6" style={{ padding: 0, marginBottom: '24px' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 className="font-bold text-lg m-0">{t('notifikasi.table_title')}</h3>
          <div className="flex gap-3">
            <button 
              onClick={fetchTemplates}
              disabled={isLoadingTemplates}
              className="btn btn-secondary btn-sm flex items-center gap-2" 
              style={{ backgroundColor: 'var(--bg-card-2)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              <Loader2 size={14} className={isLoadingTemplates ? 'animate-spin' : ''} /> {t('notifikasi.refresh')}
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="btn btn-sm flex items-center gap-2" 
              style={{ backgroundColor: '#2563eb', color: '#fff', padding: '6px 16px', borderRadius: '6px', fontWeight: '500' }}
            >
              <Send size={14} /> {t('notifikasi.broadcast_now')}
            </button>
            <button 
              onClick={() => setIsTemplateModalOpen(true)}
              className="btn btn-secondary btn-sm" 
              style={{ backgroundColor: '#cbd5e1', color: '#1e293b', border: '1px solid #94a3b8' }}
            >
              {t('notifikasi.create_template')}
            </button>
          </div>
        </div>
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>{t('notifikasi.th_name')}</th>
                <th>{t('notifikasi.th_trigger')}</th>
                <th>{t('notifikasi.th_recipient')}</th>
                <th>{t('notifikasi.th_status')}</th>
                <th>{t('notifikasi.th_action')}</th>
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
                  <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>{t('notifikasi.empty')}</td>
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
                      <Edit2 size={14} /> {t('notifikasi.detail')}
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
          <h3 className="font-bold text-lg m-0">{t('notifikasi.log_title')}</h3>
        </div>
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>{t('notifikasi.log_th_time')}</th>
                <th>{t('notifikasi.log_th_template')}</th>
                <th>{t('notifikasi.log_th_recipient')}</th>
                <th>{t('notifikasi.log_th_status')}</th>
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
                  <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>{t('notifikasi.log_empty')}</td>
                </tr>
              ) : logs.map((l, i) => (
                <tr key={i}>
                  <td>{formatDateTime(l.waktu, undefined, lang)}</td>
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
                {t('notifikasi.modal_title')}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="transition-colors rounded-full p-1.5" style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleBroadcast} className="p-6 space-y-5">
              <div className="bg-blue-50/80 border border-blue-200/60 rounded-lg p-3.5 text-sm flex gap-3 shadow-sm" style={{ color: 'var(--accent-blue)' }}>
                <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                <p className="leading-relaxed">{t('notifikasi.modal_info')}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2.5" style={{ color: 'var(--text-secondary)' }}>{t('notifikasi.msg_type')}</label>
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
                    <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('notifikasi.msg_template')} <span className="text-xs font-normal ml-1" style={{ color: 'var(--text-muted)' }}>{t('notifikasi.msg_recommended')}</span></span>
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
                    <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('notifikasi.msg_free')} <span className="text-xs font-normal ml-1" style={{ color: 'var(--text-muted)' }}>{t('notifikasi.msg_limit')}</span></span>
                  </label>
                </div>
              </div>

              {messageType === 'text' ? (
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>{t('notifikasi.msg_text')}</label>
                  <textarea
                    className="form-control"
                    rows="4"
                    placeholder={t('notifikasi.msg_text_ph')}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>{t('notifikasi.msg_choose')}</label>
                  <select
                    className="form-control"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    required
                  >
                    <option value="">{t('notifikasi.msg_choose_ph')}</option>
                    {templates.filter(t => t.status === 'APPROVED').map(t => (
                      <option key={t.id} value={t.name}>{t.name} ({t.language})</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>{t('notifikasi.msg_hint')}</p>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t mt-6" style={{ borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                >
                  {t('notifikasi.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary disabled:opacity-70 flex items-center gap-2"
                >
                  {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> {t('notifikasi.sending')}</> : <><Send size={16} /> {t('notifikasi.send_now')}</>}
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
                {t('notifikasi.tpl_title')}
              </h3>
              <button onClick={() => setIsTemplateModalOpen(false)} className="transition-colors rounded-full p-1.5" style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreateTemplate} className="p-6 space-y-5">
              <div className="bg-blue-50/80 border border-blue-200/60 rounded-lg p-3.5 text-sm flex gap-3 shadow-sm" style={{ color: 'var(--accent-blue)' }}>
                <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                <p className="leading-relaxed">{t('notifikasi.tpl_info')}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>{t('notifikasi.tpl_name')}</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder={t('notifikasi.tpl_name_ph')}
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                />
                <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>{t('notifikasi.tpl_name_hint')}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>{t('notifikasi.tpl_body')}</label>
                <textarea
                  className="form-control"
                  rows="5"
                  placeholder={t('notifikasi.tpl_body_ph')}
                  value={newTemplateBody}
                  onChange={(e) => setNewTemplateBody(e.target.value)}
                />
                <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>{t('notifikasi.tpl_body_hint')}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>{t('notifikasi.tpl_trigger')}</label>
                  <select
                    className="form-control"
                    value={newTemplateTrigger}
                    onChange={(e) => setNewTemplateTrigger(e.target.value)}
                  >
                    <option value="MANUAL">{t('notifikasi.tpl_manual')}</option>
                    <option value="H_MIN_1">{t('notifikasi.tpl_h1')}</option>
                    <option value="H_MIN_3">{t('notifikasi.tpl_h3')}</option>
                    <option value="MINGGUAN">{t('notifikasi.tpl_weekly')}</option>
                    <option value="BULANAN">{t('notifikasi.tpl_monthly')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>{t('notifikasi.tpl_recipient')}</label>
                  <select
                    className="form-control"
                    value={newTemplateUnit}
                    onChange={(e) => setNewTemplateUnit(e.target.value)}
                  >
                    <option value="SEMUA">{t('notifikasi.tpl_all')}</option>
                    <option value="PUSAT">{t('notifikasi.tpl_center')}</option>
                    <option value="DAERAH">{t('notifikasi.tpl_region')}</option>
                    <option value="CABANG">{t('notifikasi.tpl_branch')}</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t mt-6" style={{ borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="btn btn-secondary"
                >
                  {t('notifikasi.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTemplate}
                  className="btn btn-primary disabled:opacity-70 flex items-center gap-2"
                >
                  {isCreatingTemplate ? <><Loader2 size={16} className="animate-spin" /> {t('notifikasi.tpl_saving')}</> : <><Send size={16} /> {t('notifikasi.tpl_create')}</>}
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
