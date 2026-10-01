import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Edit2, Loader2, QrCode, RefreshCw, Send, ShieldCheck, Smartphone, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { waCloudApi } from '../../api/waCloud.api';
import { API_ERROR_TOAST_ID } from '../../api/client';
import { formatDateTime } from '../../utils/format';

const LOG_PAGE_SIZE = 10;
const EMPTY_TRANSPORT = {
  state: 'disabled',
  connected: false,
  enabled: false,
  retry_scheduled: false,
  pairing_required: false,
  pairing_web_enabled: false,
  pairing_qr_available: false,
  terminal_reason: null,
};
const EMPTY_PAIRING_QR = {
  available: false,
  image_data_url: null,
  expires_at: null,
};
const EMPTY_QUEUE = {
  total: 0,
  pending: 0,
  processing: 0,
  retry: 0,
  accepted: 0,
  delivered: 0,
  failed: 0,
  expired: 0,
  due: 0,
  staleLocks: 0,
};
const EMPTY_METRICS = {
  created: 0,
  accepted: 0,
  delivered: 0,
  by_status: {},
  by_type: {},
};
const EMPTY_PAGINATION = {
  total: 0,
  page: 1,
  limit: LOG_PAGE_SIZE,
  totalPages: 0,
  hasNextPage: false,
  hasPrevPage: false,
};

const countValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const normalizeQueueResult = (value = {}) => ({
  queued: countValue(value.queued),
  duplicate: countValue(value.duplicate),
  failed: countValue(value.failed),
  skipped: countValue(value.skipped),
});

const queueResultFromError = (error) => {
  const details = error?.response?.data?.errors;
  if (!details || Array.isArray(details) || typeof details !== 'object') return null;
  if (!['queued', 'duplicate', 'failed', 'skipped'].some((key) => key in details)) return null;
  return details;
};

const statusColors = (status) => {
  if (['ACCEPTED', 'DELIVERED'].includes(status)) {
    return { background: 'var(--success-bg)', color: 'var(--success)', border: 'var(--success-border)' };
  }
  if (['FAILED', 'EXPIRED'].includes(status)) {
    return { background: 'var(--danger-bg)', color: 'var(--danger)', border: 'var(--danger-border)' };
  }
  if (status === 'RETRY') {
    return { background: 'var(--warning-bg)', color: 'var(--warning)', border: 'var(--warning-border)' };
  }
  return { background: 'var(--bg-card-2)', color: 'var(--text-primary)', border: 'var(--border)' };
};

const Dialog = ({ titleId, title, icon, closeLabel, onClose, children }) => {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="rounded-xl shadow-xl w-full max-w-lg overflow-hidden border"
        style={{ backgroundColor: 'var(--bg-modal)', borderColor: 'var(--border)' }}
      >
        <div
          className="px-6 py-4 border-b flex justify-between items-center"
          style={{ backgroundColor: 'var(--bg-modal-2)', borderColor: 'var(--border)' }}
        >
          <h3 id={titleId} className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            {icon}
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="transition-colors rounded-full p-1.5"
            style={{ color: 'var(--text-muted)' }}
            aria-label={closeLabel}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

const NotifikasiPage = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [messageType, setMessageType] = useState('template');
  const [messageText, setMessageText] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [broadcastUnit, setBroadcastUnit] = useState('SEMUA');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateBody, setNewTemplateBody] = useState('');
  const [newTemplateType, setNewTemplateType] = useState('BROADCAST');
  const [newTemplateTrigger, setNewTemplateTrigger] = useState('MANUAL');
  const [newTemplateUnit, setNewTemplateUnit] = useState('SEMUA');
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);

  const [templates, setTemplates] = useState([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templatesError, setTemplatesError] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logPage, setLogPage] = useState(1);
  const [logPagination, setLogPagination] = useState(EMPTY_PAGINATION);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logsError, setLogsError] = useState(false);
  const logRequestIdRef = useRef(0);
  const [transport, setTransport] = useState(EMPTY_TRANSPORT);
  const [queue, setQueue] = useState(EMPTY_QUEUE);
  const [hasStatusData, setHasStatusData] = useState(false);
  const [statusError, setStatusError] = useState(false);
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [hasMetricsData, setHasMetricsData] = useState(false);
  const [metricsError, setMetricsError] = useState(false);
  const [pendingUnits, setPendingUnits] = useState([]);
  const [hasPendingData, setHasPendingData] = useState(false);
  const [pendingUnitsError, setPendingUnitsError] = useState(false);
  const [isLoadingPendingUnits, setIsLoadingPendingUnits] = useState(false);
  const [sendingUnitId, setSendingUnitId] = useState(null);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [pairingQr, setPairingQr] = useState(EMPTY_PAIRING_QR);
  const [isLoadingPairingQr, setIsLoadingPairingQr] = useState(false);
  const [pairingQrError, setPairingQrError] = useState(false);
  const pairingQrRequestIdRef = useRef(0);

  const fetchTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    try {
      const response = await waCloudApi.getTemplates();
      setTemplates(Array.isArray(response.data) ? response.data : []);
      setTemplatesError(false);
    } catch {
      setTemplatesError(true);
      toast.error(t('notifikasi.fetch_fail'), { id: API_ERROR_TOAST_ID });
    } finally {
      setIsLoadingTemplates(false);
    }
  }, [t]);

  const fetchLogs = useCallback(async (page) => {
    const requestId = ++logRequestIdRef.current;
    setIsLoadingLogs(true);
    try {
      const response = await waCloudApi.getLogs({ page, limit: LOG_PAGE_SIZE });
      if (requestId !== logRequestIdRef.current) return;
      setLogs(Array.isArray(response.data?.items) ? response.data.items : []);
      setLogPagination(response.data?.pagination || { ...EMPTY_PAGINATION, page });
      setLogsError(false);
    } catch {
      if (requestId !== logRequestIdRef.current) return;
      setLogsError(true);
      toast.error(t('notifikasi.logs_fetch_fail'), { id: API_ERROR_TOAST_ID });
    } finally {
      if (requestId === logRequestIdRef.current) setIsLoadingLogs(false);
    }
  }, [t]);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await waCloudApi.getWaStatus();
      setTransport({ ...EMPTY_TRANSPORT, ...(response.data?.transport || {}) });
      setQueue({ ...EMPTY_QUEUE, ...(response.data?.queue || {}) });
      setHasStatusData(true);
      setStatusError(false);
    } catch {
      setStatusError(true);
    }
  }, []);

  const fetchPairingQr = useCallback(async () => {
    const requestId = ++pairingQrRequestIdRef.current;
    setIsLoadingPairingQr(true);
    try {
      const response = await waCloudApi.getPairingQr();
      if (requestId !== pairingQrRequestIdRef.current) return;
      setPairingQr({ ...EMPTY_PAIRING_QR, ...(response.data || {}) });
      setPairingQrError(false);
    } catch {
      if (requestId !== pairingQrRequestIdRef.current) return;
      setPairingQrError(true);
    } finally {
      if (requestId === pairingQrRequestIdRef.current) setIsLoadingPairingQr(false);
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await waCloudApi.getMetrics();
      setMetrics({ ...EMPTY_METRICS, ...(response.data || {}) });
      setHasMetricsData(true);
      setMetricsError(false);
    } catch {
      setMetricsError(true);
    }
  }, []);

  const fetchPendingUnits = useCallback(async () => {
    setIsLoadingPendingUnits(true);
    try {
      const response = await waCloudApi.getUnitBelumLapor();
      setPendingUnits(Array.isArray(response.data) ? response.data : []);
      setHasPendingData(true);
      setPendingUnitsError(false);
    } catch {
      setPendingUnitsError(true);
    } finally {
      setIsLoadingPendingUnits(false);
    }
  }, []);

  const refreshOperationalData = useCallback(async () => {
    setIsRefreshingStatus(true);
    try {
      await Promise.all([fetchStatus(), fetchMetrics(), fetchPendingUnits()]);
    } finally {
      setIsRefreshingStatus(false);
    }
  }, [fetchMetrics, fetchPendingUnits, fetchStatus]);

  useEffect(() => {
    const task = window.setTimeout(() => {
      void Promise.all([fetchTemplates(), refreshOperationalData()]);
    }, 0);
    return () => window.clearTimeout(task);
  }, [fetchTemplates, refreshOperationalData]);

  useEffect(() => {
    const task = window.setTimeout(() => {
      void fetchLogs(logPage);
    }, 0);
    return () => window.clearTimeout(task);
  }, [fetchLogs, logPage]);

  useEffect(() => {
    if (!hasStatusData || transport.connected || !transport.enabled) return undefined;

    const polling = window.setInterval(() => {
      void fetchStatus();
    }, 5000);
    return () => window.clearInterval(polling);
  }, [fetchStatus, hasStatusData, transport.connected, transport.enabled]);

  useEffect(() => {
    if (
      !transport.pairing_required ||
      transport.connected ||
      !transport.pairing_web_enabled
    ) {
      pairingQrRequestIdRef.current += 1;
      return undefined;
    }

    const firstLoad = window.setTimeout(() => {
      setPairingQr(EMPTY_PAIRING_QR);
      setPairingQrError(false);
      void fetchPairingQr();
    }, 0);
    const polling = window.setInterval(() => {
      void fetchPairingQr();
    }, 5000);

    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(polling);
    };
  }, [fetchPairingQr, transport.connected, transport.pairing_required, transport.pairing_web_enabled]);

  const showQueueOutcome = useCallback((rawResult, toastId) => {
    const result = normalizeQueueResult(rawResult);
    const message = t('notifikasi.queue_result', result);
    const options = toastId ? { id: toastId } : undefined;

    if (result.failed > 0 && result.queued + result.duplicate === 0) {
      toast.error(message, options);
    } else if (result.failed > 0 || result.skipped > 0) {
      toast(message, { ...options, icon: '⚠️' });
    } else if (result.queued === 0 && result.duplicate > 0) {
      toast(message, { ...options, icon: 'ℹ️' });
    } else if (result.queued > 0) {
      toast.success(message, options);
    } else {
      toast.error(t('notifikasi.no_recipient'), options);
    }
    return result;
  }, [t]);

  const refreshAfterQueue = useCallback(async () => {
    await Promise.all([fetchLogs(1), refreshOperationalData()]);
    setLogPage(1);
  }, [fetchLogs, refreshOperationalData]);

  const handleQueueError = useCallback((error) => {
    const result = queueResultFromError(error);
    if (result) {
      showQueueOutcome(result, API_ERROR_TOAST_ID);
      return;
    }
    toast.error(error?.response?.data?.message || t('notifikasi.send_fail'), {
      id: API_ERROR_TOAST_ID,
    });
  }, [showQueueOutcome, t]);

  const handleSendToUnit = async (idUnit) => {
    setSendingUnitId(idUnit);
    try {
      const response = await waCloudApi.kirimPerUnit(idUnit);
      showQueueOutcome(response.data);
      await refreshAfterQueue();
    } catch (error) {
      handleQueueError(error);
    } finally {
      setSendingUnitId(null);
    }
  };

  const handleBroadcast = async (event) => {
    event.preventDefault();
    if (messageType === 'text' && !messageText.trim()) {
      toast.error(t('notifikasi.text_required'));
      return;
    }
    if (messageType === 'template' && !templateName) {
      toast.error(t('notifikasi.template_required'));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        messageType,
        unitPenerima: broadcastUnit,
        ...(messageType === 'text'
          ? { messageText: messageText.trim() }
          : { templateName }),
      };
      const response = await waCloudApi.sendBroadcast(payload);
      showQueueOutcome(response.data);
      setIsBroadcastModalOpen(false);
      setMessageText('');
      setTemplateName('');
      await refreshAfterQueue();
    } catch (error) {
      handleQueueError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTemplate = async (event) => {
    event.preventDefault();
    if (!newTemplateName.trim() || !newTemplateBody.trim()) {
      toast.error(t('notifikasi.form_required'));
      return;
    }

    setIsCreatingTemplate(true);
    try {
      const response = await waCloudApi.createTemplate({
        name: newTemplateName,
        body: newTemplateBody,
        trigger: newTemplateTrigger,
        unit: newTemplateUnit,
        tipe_notifikasi: newTemplateType,
      });
      toast.success(response.message || t('notifikasi.create_success'));
      setIsTemplateModalOpen(false);
      setNewTemplateName('');
      setNewTemplateBody('');
      setNewTemplateType('BROADCAST');
      setNewTemplateTrigger('MANUAL');
      setNewTemplateUnit('SEMUA');
      await fetchTemplates();
    } catch (error) {
      toast.error(error?.response?.data?.message || t('notifikasi.create_fail'), {
        id: API_ERROR_TOAST_ID,
      });
    } finally {
      setIsCreatingTemplate(false);
    }
  };

  const queueDepth = countValue(queue.pending) + countValue(queue.processing) + countValue(queue.retry);
  const hasOperationalError = statusError || metricsError || pendingUnitsError || templatesError || logsError;
  const failedToday = countValue(metrics.by_status?.FAILED) + countValue(metrics.by_status?.EXPIRED);
  const approvedBroadcastTemplates = useMemo(
    () => templates.filter((template) => (
      template.status === 'APPROVED' && template.tipe_notifikasi === 'BROADCAST'
    )),
    [templates]
  );
  const transportColor = transport.connected ? 'var(--success)' : transport.state === 'connecting' ? 'var(--warning)' : 'var(--danger)';
  const transportBackground = transport.connected ? 'var(--success-bg)' : transport.state === 'connecting' ? 'var(--warning-bg)' : 'var(--danger-bg)';
  const transportBorder = transport.connected ? 'var(--success-border)' : transport.state === 'connecting' ? 'var(--warning-border)' : 'var(--danger-border)';

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="text-sm text-muted font-medium mb-1">
            {t('manajemen.title')} <span className="mx-1">&gt;</span>{' '}
            <span className="text-primary">{t('notifikasi.breadcrumb')}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span
            title={t('notifikasi.transport_hint')}
            style={{
              padding: '4px 12px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 700,
              backgroundColor: transportBackground,
              color: transportColor,
              border: `1px solid ${transportBorder}`,
            }}
          >
            {hasStatusData
              ? `${transport.connected ? '●' : '○'} ${t('notifikasi.transport_state', { state: transport.state })}`
              : t('notifikasi.data_unavailable')}
          </span>
          <span
            style={{
              padding: '4px 12px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 700,
              backgroundColor: 'var(--bg-card-2)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            {hasStatusData
              ? t('notifikasi.queue_depth', { count: queueDepth })
              : t('notifikasi.queue_unavailable')}
          </span>
          <button
            type="button"
            onClick={refreshOperationalData}
            disabled={isRefreshingStatus}
            className="btn btn-secondary btn-sm flex items-center gap-2"
          >
            <RefreshCw size={14} className={isRefreshingStatus ? 'animate-spin' : ''} aria-hidden="true" />
            {t('notifikasi.refresh')}
          </button>
        </div>
      </div>

      {hasOperationalError && (
        <div role="alert" className="mb-4 p-3 rounded-lg border flex items-start gap-2" style={{ background: 'var(--danger-bg)', borderColor: 'var(--danger-border)', color: 'var(--danger)' }}>
          <AlertCircle size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>
            {t(hasStatusData || hasMetricsData || hasPendingData
              ? 'notifikasi.stale_data'
              : 'notifikasi.refresh_failed')}
          </span>
        </div>
      )}

      {transport.pairing_required && (
        transport.pairing_web_enabled ? (
          <section
            aria-labelledby="whatsapp-pairing-title"
            className="card mb-6 overflow-hidden"
            style={{
              padding: 0,
              borderColor: 'var(--warning-border)',
              background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--warning-bg) 160%)',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 0,
              }}
            >
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--warning)' }}>
                    <ShieldCheck size={16} aria-hidden="true" />
                    {t('notifikasi.pairing_secure_label')}
                  </div>
                  <h2 id="whatsapp-pairing-title" className="text-xl font-bold m-0" style={{ color: 'var(--text-primary)' }}>
                    {t('notifikasi.pairing_title')}
                  </h2>
                  <p className="text-sm mt-2 mb-0" style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                    {t('notifikasi.pairing_intro')}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                    {t('notifikasi.pairing_steps_title')}
                  </p>
                  <ol className="m-0 pl-5 text-sm space-y-2" style={{ color: 'var(--text-secondary)' }}>
                    <li>{t('notifikasi.pairing_step_1')}</li>
                    <li>{t('notifikasi.pairing_step_2')}</li>
                    <li>{t('notifikasi.pairing_step_3')}</li>
                  </ol>
                </div>

                <div
                  className="flex items-start gap-3 rounded-lg border p-3"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                >
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} aria-hidden="true" />
                  <p className="text-xs m-0" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    {t('notifikasi.pairing_security_note')}
                  </p>
                </div>
              </div>

              <div
                style={{
                  padding: '24px',
                  borderLeft: '1px solid var(--warning-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  minHeight: '390px',
                }}
              >
                <div
                  style={{
                    width: 'min(100%, 320px)',
                    aspectRatio: '1 / 1',
                    background: '#fff',
                    borderRadius: '16px',
                    padding: '12px',
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: '0 16px 38px rgba(15, 23, 42, 0.14)',
                    border: '1px solid rgba(15, 23, 42, 0.08)',
                  }}
                >
                  {pairingQr.available && pairingQr.image_data_url ? (
                    <img
                      src={pairingQr.image_data_url}
                      alt={t('notifikasi.pairing_qr_alt')}
                      width="296"
                      height="296"
                      style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : isLoadingPairingQr ? (
                    <div className="text-center" style={{ color: '#475569' }}>
                      <Loader2 size={38} className="animate-spin mx-auto mb-3" aria-hidden="true" />
                      <p className="text-sm font-semibold m-0">{t('notifikasi.pairing_qr_loading')}</p>
                    </div>
                  ) : (
                    <div className="text-center px-5" style={{ color: pairingQrError ? '#b91c1c' : '#475569' }}>
                      <QrCode size={48} className="mx-auto mb-3" aria-hidden="true" />
                      <p className="text-sm font-semibold m-0">
                        {t(pairingQrError ? 'notifikasi.pairing_qr_error' : 'notifikasi.pairing_qr_waiting')}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <Smartphone size={15} aria-hidden="true" />
                  <span>
                    {pairingQr.expires_at
                      ? t('notifikasi.pairing_qr_expires', { time: formatDateTime(pairingQr.expires_at, undefined, lang) })
                      : t('notifikasi.pairing_qr_auto_refresh')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void Promise.all([fetchPairingQr(), fetchStatus()])}
                  disabled={isLoadingPairingQr}
                  className="btn btn-secondary btn-sm flex items-center gap-2"
                >
                  <RefreshCw size={14} className={isLoadingPairingQr ? 'animate-spin' : ''} aria-hidden="true" />
                  {t(isLoadingPairingQr ? 'notifikasi.pairing_qr_refreshing' : 'notifikasi.pairing_qr_refresh')}
                </button>
              </div>
            </div>
          </section>
        ) : (
          <div role="alert" className="mb-4 p-3 rounded-lg border flex items-start gap-2" style={{ background: 'var(--warning-bg)', borderColor: 'var(--warning-border)', color: 'var(--warning)' }}>
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>{t('notifikasi.pairing_required')}</span>
          </div>
        )
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <p className="text-muted text-sm mb-1 font-medium">{t('notifikasi.total_active')}</p>
          <h3 className="text-3xl font-bold">{isLoadingTemplates ? '-' : templates.filter((template) => template.status === 'APPROVED').length}</h3>
        </div>
        <div className="card" style={{ padding: '16px 20px' }}>
          <p className="text-muted text-sm mb-1 font-medium">{t('notifikasi.sent_today')}</p>
          <h3 className="text-3xl font-bold">{hasMetricsData ? countValue(metrics.accepted) : '-'}</h3>
          <p className="text-xs text-muted mt-1">
            {hasMetricsData ? t('notifikasi.delivered_today', { count: countValue(metrics.delivered) }) : t('notifikasi.data_unavailable')}
          </p>
        </div>
        <div className="card" style={{ padding: '16px 20px' }}>
          <p className="text-muted text-sm mb-1 font-medium">{t('notifikasi.failed')}</p>
          <h3 className="text-3xl font-bold">{hasMetricsData ? failedToday : '-'}</h3>
          <p className="text-xs text-muted mt-1">
            {hasMetricsData ? t('notifikasi.created_today', { count: countValue(metrics.created) }) : t('notifikasi.data_unavailable')}
          </p>
        </div>
        <div className="card" style={{ padding: '16px 20px' }}>
          <p className="text-muted text-sm mb-1 font-medium">{t('notifikasi.pending_units')}</p>
          <h3 className="text-3xl font-bold">{isLoadingPendingUnits || !hasPendingData ? '-' : pendingUnits.length}</h3>
        </div>
      </div>

      <div className="card p-0 mb-6" style={{ padding: 0, marginBottom: '24px' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <h3 className="font-bold text-lg m-0">{t('notifikasi.pending_title')}</h3>
            <p className="text-xs text-muted mt-1">{t('notifikasi.outbox_hint')}</p>
          </div>
          <button type="button" onClick={fetchPendingUnits} disabled={isLoadingPendingUnits} className="btn btn-secondary btn-sm flex items-center gap-2">
            <RefreshCw size={14} className={isLoadingPendingUnits ? 'animate-spin' : ''} aria-hidden="true" />
            {t('notifikasi.refresh')}
          </button>
        </div>
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>{t('notifikasi.unit')}</th>
                <th>{t('notifikasi.contacts')}</th>
                <th>{t('notifikasi.th_action')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingPendingUnits && !hasPendingData ? (
                <tr><td colSpan="3" style={{ textAlign: 'center', padding: '20px' }}><Loader2 className="animate-spin mx-auto" size={20} aria-label={t('common.loading')} /></td></tr>
              ) : pendingUnitsError && !hasPendingData ? (
                <tr><td colSpan="3" style={{ textAlign: 'center', padding: '20px', color: 'var(--danger)' }}>{t('notifikasi.data_unavailable')}</td></tr>
              ) : pendingUnits.length === 0 ? (
                <tr><td colSpan="3" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>{t('notifikasi.pending_empty')}</td></tr>
              ) : pendingUnits.map((unit) => (
                <tr key={unit.id_unit}>
                  <td style={{ fontWeight: 600 }}>{unit.nama_unit}</td>
                  <td>
                    {(unit.penanggung || []).length > 0
                      ? unit.penanggung.map((person) => `${person.nama} (${person.no_hp || t('notifikasi.no_phone')})`).join(', ')
                      : t('notifikasi.no_contact')}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleSendToUnit(unit.id_unit)}
                      disabled={sendingUnitId === unit.id_unit}
                      className="btn btn-sm flex items-center gap-2"
                      style={{ backgroundColor: '#2563eb', color: '#fff', padding: '4px 12px', borderRadius: '6px' }}
                    >
                      {sendingUnitId === unit.id_unit ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
                      {sendingUnitId === unit.id_unit ? t('notifikasi.queueing') : t('notifikasi.remind')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-0 mb-6" style={{ padding: 0, marginBottom: '24px' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <h3 className="font-bold text-lg m-0">{t('notifikasi.table_title')}</h3>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={fetchTemplates} disabled={isLoadingTemplates} className="btn btn-secondary btn-sm flex items-center gap-2">
              <RefreshCw size={14} className={isLoadingTemplates ? 'animate-spin' : ''} aria-hidden="true" />
              {t('notifikasi.refresh')}
            </button>
            <button type="button" onClick={() => setIsBroadcastModalOpen(true)} className="btn btn-sm flex items-center gap-2" style={{ backgroundColor: '#2563eb', color: '#fff' }}>
              <Send size={14} aria-hidden="true" /> {t('notifikasi.broadcast_now')}
            </button>
            <button type="button" onClick={() => setIsTemplateModalOpen(true)} className="btn btn-secondary btn-sm">
              {t('notifikasi.create_template')}
            </button>
          </div>
        </div>
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>{t('notifikasi.th_name')}</th>
                <th>{t('notifikasi.th_type')}</th>
                <th>{t('notifikasi.th_trigger')}</th>
                <th>{t('notifikasi.th_recipient')}</th>
                <th>{t('notifikasi.th_status')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingTemplates ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}><Loader2 className="animate-spin mx-auto" size={24} aria-label={t('common.loading')} /></td></tr>
              ) : templatesError && templates.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--danger)' }}>{t('notifikasi.data_unavailable')}</td></tr>
              ) : templates.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>{t('notifikasi.empty')}</td></tr>
              ) : templates.map((template) => (
                <tr key={template.id}>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{template.name}</td>
                  <td>{template.tipe_notifikasi}</td>
                  <td>{template.trigger_waktu || 'MANUAL'}</td>
                  <td>{template.unit_penerima || 'SEMUA'}</td>
                  <td>
                    <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, backgroundColor: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)' }}>
                      {template.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-0" style={{ padding: 0 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
          <div>
            <h3 className="font-bold text-lg m-0">{t('notifikasi.log_title')}</h3>
            <p className="text-xs text-muted mt-1">{t('notifikasi.log_total', { count: logPagination.total })}</p>
          </div>
          <button type="button" onClick={() => fetchLogs(logPage)} disabled={isLoadingLogs} className="btn btn-secondary btn-sm flex items-center gap-2">
            <RefreshCw size={14} className={isLoadingLogs ? 'animate-spin' : ''} aria-hidden="true" />
            {t('notifikasi.refresh')}
          </button>
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
              {isLoadingLogs && logs.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}><Loader2 className="animate-spin mx-auto" size={20} aria-label={t('common.loading')} /></td></tr>
              ) : logsError && logs.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--danger)' }}>{t('notifikasi.data_unavailable')}</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>{t('notifikasi.log_empty')}</td></tr>
              ) : logs.map((log) => {
                const colors = statusColors(log.status?.code);
                return (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.created_at, undefined, lang)}</td>
                    <td>{log.jenis}</td>
                    <td>{log.recipient?.name || '-'} · {log.recipient?.phone || '-'}</td>
                    <td>
                      <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, backgroundColor: colors.background, color: colors.color, border: `1px solid ${colors.border}` }}>
                        {log.status?.code || '-'} ({countValue(log.status?.attempts)}/{countValue(log.status?.max_attempts)})
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
          <button type="button" className="btn btn-secondary btn-sm" disabled={!logPagination.hasPrevPage || isLoadingLogs} onClick={() => setLogPage((page) => Math.max(1, page - 1))}>
            {t('notifikasi.previous')}
          </button>
          <span className="text-sm text-muted">
            {t('notifikasi.page_of', { page: logPagination.page || 1, total: Math.max(1, logPagination.totalPages || 0) })}
          </span>
          <button type="button" className="btn btn-secondary btn-sm" disabled={!logPagination.hasNextPage || isLoadingLogs} onClick={() => setLogPage((page) => page + 1)}>
            {t('notifikasi.next')}
          </button>
        </div>
      </div>

      {isBroadcastModalOpen && (
        <Dialog
          titleId="broadcast-dialog-title"
          title={t('notifikasi.modal_title')}
          icon={<Send className="text-blue-600" size={18} aria-hidden="true" />}
          closeLabel={t('notifikasi.close_dialog')}
          onClose={() => setIsBroadcastModalOpen(false)}
        >
          <form onSubmit={handleBroadcast} className="p-6 space-y-5">
            <div className="bg-blue-50/80 border border-blue-200/60 rounded-lg p-3.5 text-sm flex gap-3" style={{ color: 'var(--accent-blue)' }}>
              <AlertCircle size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              <p>{t('notifikasi.modal_info')}</p>
            </div>
            <fieldset>
              <legend className="block text-sm font-semibold mb-2.5" style={{ color: 'var(--text-secondary)' }}>{t('notifikasi.msg_type')}</legend>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="messageType" value="template" checked={messageType === 'template'} onChange={() => setMessageType('template')} autoFocus />
                  <span className="text-sm font-medium">{t('notifikasi.msg_template')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="messageType" value="text" checked={messageType === 'text'} onChange={() => setMessageType('text')} />
                  <span className="text-sm font-medium">{t('notifikasi.msg_free')}</span>
                </label>
              </div>
            </fieldset>

            {messageType === 'text' ? (
              <div>
                <label htmlFor="broadcast-message" className="block text-sm font-semibold mb-2">{t('notifikasi.msg_text')}</label>
                <textarea id="broadcast-message" className="form-control" rows="4" maxLength={100000} placeholder={t('notifikasi.msg_text_ph')} value={messageText} onChange={(event) => setMessageText(event.target.value)} required />
              </div>
            ) : (
              <div>
                <label htmlFor="broadcast-template" className="block text-sm font-semibold mb-2">{t('notifikasi.msg_choose')}</label>
                <select id="broadcast-template" className="form-control" value={templateName} onChange={(event) => setTemplateName(event.target.value)} required>
                  <option value="">{t('notifikasi.msg_choose_ph')}</option>
                  {approvedBroadcastTemplates.map((template) => <option key={template.id} value={template.name}>{template.name}</option>)}
                </select>
                <p className="mt-1.5 text-xs text-muted">{t('notifikasi.msg_hint')}</p>
              </div>
            )}

            <div>
              <label htmlFor="broadcast-unit" className="block text-sm font-semibold mb-2">{t('notifikasi.tpl_recipient')}</label>
              <select id="broadcast-unit" className="form-control" value={broadcastUnit} onChange={(event) => setBroadcastUnit(event.target.value)}>
                <option value="SEMUA">{t('notifikasi.tpl_all')}</option>
                <option value="PUSAT">{t('notifikasi.tpl_center')}</option>
                <option value="DAERAH">{t('notifikasi.tpl_region')}</option>
                <option value="CABANG">{t('notifikasi.tpl_branch')}</option>
              </select>
              {!transport.connected && <p className="mt-1.5 text-xs" style={{ color: 'var(--warning)' }}>{t('notifikasi.offline_queue_hint')}</p>}
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <button type="button" onClick={() => setIsBroadcastModalOpen(false)} className="btn btn-secondary">{t('notifikasi.cancel')}</button>
              <button type="submit" disabled={isSubmitting} className="btn btn-primary flex items-center gap-2">
                {isSubmitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                {isSubmitting ? t('notifikasi.queueing') : t('notifikasi.send_now')}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {isTemplateModalOpen && (
        <Dialog
          titleId="template-dialog-title"
          title={t('notifikasi.tpl_title')}
          icon={<Edit2 className="text-blue-600" size={18} aria-hidden="true" />}
          closeLabel={t('notifikasi.close_dialog')}
          onClose={() => setIsTemplateModalOpen(false)}
        >
          <form onSubmit={handleCreateTemplate} className="p-6 space-y-5">
            <div className="bg-blue-50/80 border border-blue-200/60 rounded-lg p-3.5 text-sm flex gap-3" style={{ color: 'var(--accent-blue)' }}>
              <AlertCircle size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              <p>{t('notifikasi.tpl_info')}</p>
            </div>
            <div>
              <label htmlFor="template-name" className="block text-sm font-semibold mb-2">{t('notifikasi.tpl_name')}</label>
              <input id="template-name" type="text" className="form-control" maxLength={100} placeholder={t('notifikasi.tpl_name_ph')} value={newTemplateName} onChange={(event) => setNewTemplateName(event.target.value.toLowerCase().replace(/\s+/g, '_'))} autoFocus required />
              <p className="mt-1.5 text-xs text-muted">{t('notifikasi.tpl_name_hint')}</p>
            </div>
            <div>
              <label htmlFor="template-body" className="block text-sm font-semibold mb-2">{t('notifikasi.tpl_body')}</label>
              <textarea id="template-body" className="form-control" rows="5" maxLength={100000} placeholder={t('notifikasi.tpl_body_ph')} value={newTemplateBody} onChange={(event) => setNewTemplateBody(event.target.value)} required />
              <p className="mt-1.5 text-xs text-muted">{t('notifikasi.tpl_body_hint')}</p>
            </div>
            <div>
              <label htmlFor="template-type" className="block text-sm font-semibold mb-2">{t('notifikasi.tpl_type')}</label>
              <select
                id="template-type"
                className="form-control"
                value={newTemplateType}
                onChange={(event) => {
                  const type = event.target.value;
                  setNewTemplateType(type);
                  if (type !== 'BROADCAST' && newTemplateTrigger === 'MANUAL') {
                    setNewTemplateTrigger('H_MIN_1');
                  }
                }}
                required
              >
                <option value="BROADCAST">{t('notifikasi.tpl_type_broadcast')}</option>
                <option value="DEADLINE">{t('notifikasi.tpl_type_deadline')}</option>
                <option value="REVISI">{t('notifikasi.tpl_type_revision')}</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="template-trigger" className="block text-sm font-semibold mb-2">{t('notifikasi.tpl_trigger')}</label>
                <select id="template-trigger" className="form-control" value={newTemplateTrigger} onChange={(event) => setNewTemplateTrigger(event.target.value)}>
                  {newTemplateType === 'BROADCAST' && <option value="MANUAL">{t('notifikasi.tpl_manual')}</option>}
                  <option value="H_MIN_1">{t('notifikasi.tpl_h1')}</option>
                  <option value="H_MIN_3">{t('notifikasi.tpl_h3')}</option>
                  <option value="MINGGUAN">{t('notifikasi.tpl_weekly')}</option>
                  <option value="BULANAN">{t('notifikasi.tpl_monthly')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="template-unit" className="block text-sm font-semibold mb-2">{t('notifikasi.tpl_recipient')}</label>
                <select id="template-unit" className="form-control" value={newTemplateUnit} onChange={(event) => setNewTemplateUnit(event.target.value)}>
                  <option value="SEMUA">{t('notifikasi.tpl_all')}</option>
                  <option value="PUSAT">{t('notifikasi.tpl_center')}</option>
                  <option value="DAERAH">{t('notifikasi.tpl_region')}</option>
                  <option value="CABANG">{t('notifikasi.tpl_branch')}</option>
                </select>
              </div>
            </div>
            <div className="pt-4 flex justify-end gap-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <button type="button" onClick={() => setIsTemplateModalOpen(false)} className="btn btn-secondary">{t('notifikasi.cancel')}</button>
              <button type="submit" disabled={isCreatingTemplate} className="btn btn-primary flex items-center gap-2">
                {isCreatingTemplate ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                {isCreatingTemplate ? t('notifikasi.tpl_saving') : t('notifikasi.tpl_create')}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
};

export default NotifikasiPage;
