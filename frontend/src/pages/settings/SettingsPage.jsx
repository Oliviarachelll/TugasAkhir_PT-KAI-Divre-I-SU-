import { useEffect, useState } from 'react';
import { CheckCircle2, Languages, Loader2, Moon, ShieldCheck, Smartphone, Sun } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { updateWhatsappContact } from '../../api/auth.api';
import { API_ERROR_TOAST_ID, apiErrorMessage } from '../../api/client';
import useAuthStore from '../../store/auth.store';

const SettingsPage = () => {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [mode, setMode] = useState(localStorage.getItem('app-theme') || 'Terang');
  const [phone, setPhone] = useState(user?.no_hp || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [isSavingContact, setIsSavingContact] = useState(false);
  const isDark = mode === 'Gelap';
  const hasRegisteredPhone = Boolean(user?.no_hp);

  useEffect(() => {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('app-theme', mode);
  }, [isDark, mode]);

  const toggleMode = () => {
    setMode((previous) => (previous === 'Terang' ? 'Gelap' : 'Terang'));
  };

  const handleContactSubmit = async (event) => {
    event.preventDefault();

    if (!phone.trim()) {
      toast.error(t('settings.phone_required'));
      return;
    }
    if (!currentPassword) {
      toast.error(t('settings.password_required'));
      return;
    }

    setIsSavingContact(true);
    try {
      const response = await updateWhatsappContact({
        phone: phone.trim(),
        password: currentPassword,
      });
      updateUser(response.data);
      setPhone(response.data.no_hp);
      setCurrentPassword('');
      toast.success(response.message || t('settings.contact_save_success'));
    } catch (error) {
      toast.error(
        apiErrorMessage(error, t('settings.contact_save_error')),
        { id: API_ERROR_TOAST_ID }
      );
    } finally {
      setIsSavingContact(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="text-sm text-muted font-medium mb-1">
            {t('menu.settings')} <span className="mx-1">&gt;</span>{' '}
            <span className="text-primary">{t('menu.settings')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="card xl:col-span-2" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            className="flex items-start justify-between gap-4"
            style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}
          >
            <div className="flex items-start gap-4">
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  color: '#ffffff',
                  background: 'linear-gradient(145deg, var(--brand-500), var(--brand-600))',
                  boxShadow: '0 10px 24px rgba(0, 91, 172, 0.18)',
                }}
              >
                <Smartphone size={23} />
              </div>
              <div>
                <div className="text-xs font-bold tracking-wider text-primary mb-1">
                  {t('settings.contact_eyebrow')}
                </div>
                <h2 className="text-xl font-bold mb-1">{t('settings.contact_title')}</h2>
                <p className="text-sm text-muted" style={{ maxWidth: '680px', lineHeight: 1.65 }}>
                  {t('settings.contact_desc')}
                </p>
              </div>
            </div>
            <div
              className="flex items-center gap-2 shrink-0 text-xs font-bold"
              style={{
                padding: '8px 12px',
                borderRadius: '999px',
                color: hasRegisteredPhone ? 'var(--success, #15803d)' : 'var(--warning, #b45309)',
                backgroundColor: hasRegisteredPhone
                  ? 'rgba(22, 163, 74, 0.10)'
                  : 'rgba(245, 158, 11, 0.12)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'currentColor',
                }}
              />
              {hasRegisteredPhone
                ? t('settings.contact_registered')
                : t('settings.contact_unregistered')}
            </div>
          </div>

          <form onSubmit={handleContactSubmit} style={{ padding: '24px' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="form-group mb-0">
                <label className="form-label" htmlFor="settings-whatsapp-phone">
                  {t('settings.phone_label')}
                </label>
                <input
                  id="settings-whatsapp-phone"
                  className="form-control"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={40}
                  placeholder={t('settings.phone_placeholder')}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  disabled={isSavingContact}
                />
                <p className="text-xs text-muted mt-2">{t('settings.phone_hint')}</p>
              </div>

              <div className="form-group mb-0">
                <label className="form-label" htmlFor="settings-current-password">
                  {t('settings.password_label')}
                </label>
                <input
                  id="settings-current-password"
                  className="form-control"
                  type="password"
                  autoComplete="current-password"
                  placeholder={t('settings.password_placeholder')}
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  disabled={isSavingContact}
                />
                <p className="text-xs text-muted mt-2">{t('settings.password_hint')}</p>
              </div>
            </div>

            <div
              className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-6"
              style={{
                padding: '16px',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                backgroundColor: 'var(--background, rgba(148, 163, 184, 0.06))',
              }}
            >
              <div className="flex items-start gap-3">
                <ShieldCheck className="text-primary shrink-0 mt-0.5" size={19} />
                <div>
                  <p className="text-sm font-semibold">{t('settings.security_title')}</p>
                  <p className="text-xs text-muted mt-1" style={{ lineHeight: 1.55 }}>
                    {t('settings.security_note')}
                  </p>
                </div>
              </div>
              <button
                className="btn btn-primary flex items-center justify-center gap-2 shrink-0"
                type="submit"
                disabled={isSavingContact}
              >
                {isSavingContact ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    {t('settings.saving_contact')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={17} />
                    {t('settings.save_contact')}
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        <aside className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
            <h3 className="text-lg font-bold">{t('settings.profile_title')}</h3>
            <p className="text-sm text-muted mt-1">{t('settings.profile_desc')}</p>
          </div>
          <dl style={{ padding: '8px 24px 24px' }}>
            <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
              <dt className="text-xs text-muted font-semibold mb-1">{t('settings.profile_name')}</dt>
              <dd className="text-sm font-bold">{user?.nama || '-'}</dd>
            </div>
            <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
              <dt className="text-xs text-muted font-semibold mb-1">Email</dt>
              <dd className="text-sm font-medium break-all">{user?.email || '-'}</dd>
            </div>
            <div style={{ padding: '16px 0' }}>
              <dt className="text-xs text-muted font-semibold mb-1">{t('settings.profile_unit')}</dt>
              <dd className="text-sm font-medium">{user?.unit?.nama_unit || '-'}</dd>
            </div>
          </dl>
        </aside>
      </div>

      <section className="card mt-6" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-lg font-bold">{t('settings.appearance_title')}</h3>
          <p className="text-sm text-muted mt-1">{t('settings.appearance_desc')}</p>
        </div>

        <div
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
          style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <Languages className="text-primary" size={20} />
            <div>
              <h4 className="font-bold text-base mb-1">{t('settings.lang_title')}</h4>
              <p className="text-sm text-muted">{t('settings.lang_desc')}</p>
            </div>
          </div>
          <select
            className="form-control"
            style={{ width: '220px', cursor: 'pointer' }}
            value={i18n.language === 'en' ? 'en' : 'id'}
            onChange={(event) => i18n.changeLanguage(event.target.value)}
          >
            <option value="id">Bahasa Indonesia</option>
            <option value="en">English</option>
          </select>
        </div>

        <div
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
          style={{ padding: '24px' }}
        >
          <div className="flex items-center gap-3">
            {isDark ? <Moon className="text-primary" size={20} /> : <Sun className="text-primary" size={20} />}
            <div>
              <h4 className="font-bold text-base mb-1">{t('settings.mode_title')}</h4>
              <p className="text-sm text-muted">{t('settings.mode_desc')}</p>
            </div>
          </div>
          <button
            type="button"
            aria-pressed={isDark}
            aria-label={t('settings.mode_title')}
            onClick={toggleMode}
            style={{
              width: '56px',
              height: '32px',
              border: 0,
              borderRadius: '16px',
              backgroundColor: isDark ? 'var(--brand-500)' : '#E5E7EB',
              position: 'relative',
              cursor: 'pointer',
              transition: 'background-color 0.3s ease',
            }}
          >
            <span
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#FFFFFF',
                position: 'absolute',
                top: '4px',
                left: isDark ? '28px' : '4px',
                transition: 'left 0.3s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
              }}
            />
          </button>
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;
