import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldAlert, Loader2, KeyRound, ChevronLeft, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/auth.store';
import {
  requestPasswordReset,
  requestUnlockTicket,
  resetPassword,
} from '../../api/auth.api';
import kaiLogo from '../../assets/logokai.webp';
import { useTranslation } from 'react-i18next';

const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TOKEN_LENGTH = 16;
const RECOVERY_TOKEN_PATTERN = /^[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3}$/;
const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_BYTES = 72;

const formatRecoveryToken = (value) => {
  const normalized = Array.from(String(value || '').toUpperCase())
    .filter((character) => CROCKFORD_ALPHABET.includes(character))
    .slice(0, TOKEN_LENGTH)
    .join('');
  return normalized.match(/.{1,4}/g)?.join('-') || '';
};

const AccessibleDialog = ({ titleId, closeLabel, onClose, children }) => (
  <div
    className="modal-overlay"
    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50, padding: '16px' }}
  >
    <div
      className="modal bg-white rounded-xl shadow-xl"
      style={{ width: '450px', maxWidth: '100%', padding: '32px', backgroundColor: 'var(--bg-modal)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="text-gray-500 hover:text-gray-900 mb-6 flex items-center gap-1 text-sm bg-transparent border-none cursor-pointer p-0"
        onClick={onClose}
        aria-label={closeLabel}
      >
        <ChevronLeft size={16} aria-hidden="true" /> {closeLabel}
      </button>
      {children}
    </div>
  </div>
);

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [showResetRequestModal, setShowResetRequestModal] = useState(false);
  const [resetRequestEmail, setResetRequestEmail] = useState('');
  const [resetRequestError, setResetRequestError] = useState('');
  const [resetRequestSuccess, setResetRequestSuccess] = useState('');
  const [isRequestingReset, setIsRequestingReset] = useState(false);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const [showRequestUnlockModal, setShowRequestUnlockModal] = useState(false);
  const [unlockEmail, setUnlockEmail] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlockSuccess, setUnlockSuccess] = useState('');
  const [isRequestingUnlock, setIsRequestingUnlock] = useState(false);

  const { login, isAuthenticated, user } = useAuthStore();
  const { t } = useTranslation();

  if (isAuthenticated && user) {
    if (user.peran === 'IT') return <Navigate to="/dashboard/it" replace />;
    if (user.peran === 'ADMIN_GLOBAL') return <Navigate to="/dashboard/admin" replace />;
    return <Navigate to="/dashboard/unit" replace />;
  }

  const handleLogin = async (event) => {
    event.preventDefault();
    setErrorMsg('');

    if (!email || !password) {
      setErrorMsg(t('auth.required'));
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      toast.success(t('auth.login_success'));
    } catch (error) {
      const message = error.response?.data?.message || t('auth.server_error');
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  const openResetRequest = () => {
    setResetRequestEmail(email);
    setResetRequestError('');
    setResetRequestSuccess('');
    setShowResetRequestModal(true);
  };

  const openAccountHelp = () => {
    setUnlockEmail(email);
    setUnlockError('');
    setUnlockSuccess('');
    setShowRequestUnlockModal(true);
  };

  const openTokenReset = () => {
    setShowResetRequestModal(false);
    setShowRequestUnlockModal(false);
    setResetError('');
    setResetSuccess('');
    setShowResetModal(true);
  };

  const handleResetRequest = async (event) => {
    event.preventDefault();
    setResetRequestError('');
    setResetRequestSuccess('');
    setIsRequestingReset(true);
    try {
      await requestPasswordReset(resetRequestEmail);
      setResetRequestSuccess(t('auth.reset_request_generic'));
    } catch (error) {
      setResetRequestError(error.response?.data?.message || t('auth.reset_request_fail'));
    } finally {
      setIsRequestingReset(false);
    }
  };

  const handleUnlockRequest = async (event) => {
    event.preventDefault();
    setUnlockError('');
    setUnlockSuccess('');
    setIsRequestingUnlock(true);
    try {
      await requestUnlockTicket(unlockEmail);
      setUnlockSuccess(t('auth.unlock_request_generic'));
    } catch (error) {
      setUnlockError(error.response?.data?.message || t('auth.request_fail'));
    } finally {
      setIsRequestingUnlock(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setResetError('');
    setResetSuccess('');

    if (!RECOVERY_TOKEN_PATTERN.test(resetToken)) {
      setResetError(t('auth.token_invalid'));
      return;
    }
    if (Array.from(newPassword).length < MIN_PASSWORD_LENGTH) {
      setResetError(t('auth.password_min', { count: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (new TextEncoder().encode(newPassword).length > MAX_PASSWORD_BYTES) {
      setResetError(t('auth.password_max_bytes', { count: MAX_PASSWORD_BYTES }));
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError(t('auth.confirm_mismatch'));
      return;
    }

    setIsResetting(true);
    try {
      const response = await resetPassword({ token: resetToken, password: newPassword });
      setResetSuccess(response.message || t('auth.reset_success_fallback'));
    } catch (error) {
      setResetError(error.response?.data?.message || t('auth.reset_fail'));
    } finally {
      setIsResetting(false);
    }
  };

  const closeResetDialog = () => {
    setShowResetModal(false);
    setResetToken('');
    setNewPassword('');
    setConfirmPassword('');
    setResetError('');
    setResetSuccess('');
  };

  return (
    <div className="login-split">
      <div className="login-form-container">
        <div className="flex justify-center mb-6">
          <div className="w-28 flex items-center justify-center" style={{ backgroundColor: 'transparent', boxShadow: 'none' }}>
            <img src={kaiLogo} alt="KAI Logo" className="w-full h-auto object-contain" />
          </div>
        </div>
        <div className="text-center mb-8">
          <p className="login-text text-sm font-medium">{t('auth.subtitle')}<br />{t('auth.company')}</p>
        </div>

        <form onSubmit={handleLogin} aria-busy={isLoading} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="login-email" className="login-text block text-sm font-medium mb-1.5">{t('auth.email')}</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              className="form-control text-slate-900 placeholder:text-slate-500 focus:border-purple-500 transition-colors"
              placeholder={t('auth.email_ph')}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="login-password" className="login-text block text-sm font-medium">{t('auth.password')}</label>
              <button
                type="button"
                className="login-text-dim text-xs bg-transparent border-none cursor-pointer hover:underline"
                onClick={openResetRequest}
              >
                {t('auth.forgot_password')}
              </button>
            </div>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              className="form-control text-slate-900 placeholder:text-slate-500 focus:border-purple-500 transition-colors"
              placeholder={t('auth.password_ph')}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <p className="login-text-dim text-sm mt-1">{t('auth.hint')}</p>

          <button
            type="button"
            className="login-text-dim text-xs bg-transparent border-none cursor-pointer hover:underline self-start"
            onClick={openAccountHelp}
          >
            {t('auth.account_help')}
          </button>

          {errorMsg && (
            <div role="alert" className="p-4 rounded-md" style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '6px' }}>
              <p className="text-sm text-red-200">{errorMsg}</p>
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              className="btn w-full bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 hover:opacity-90 text-white border-none py-2.5 rounded-lg shadow-lg shadow-purple-500/30 transition-all font-semibold"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="animate-spin mx-auto" size={18} aria-label={t('common.loading')} /> : t('auth.submit')}
            </button>
          </div>
        </form>

        <div className="login-text-dim mt-8 text-center text-xs font-medium">
          © {new Date().getFullYear()} {t('auth.footer')}
        </div>
      </div>

      {showResetRequestModal && (
        <AccessibleDialog
          titleId="reset-request-title"
          closeLabel={t('auth.back_login')}
          onClose={() => setShowResetRequestModal(false)}
        >
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 mb-4 border border-dashed border-blue-200">
              <KeyRound size={24} className="text-blue-600" aria-hidden="true" />
            </div>
            <h3 id="reset-request-title" className="text-xl font-bold">{t('auth.reset_request_title')}</h3>
            <p className="text-sm text-gray-500 mt-2">{t('auth.reset_request_desc')}</p>
          </div>
          <form onSubmit={handleResetRequest} aria-busy={isRequestingReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="reset-request-email" className="form-label text-left w-full block font-medium">{t('auth.your_email')}</label>
              <input
                id="reset-request-email"
                type="email"
                autoComplete="email"
                className="form-control"
                placeholder={t('auth.registered_email_ph')}
                value={resetRequestEmail}
                onChange={(event) => setResetRequestEmail(event.target.value)}
                disabled={isRequestingReset || Boolean(resetRequestSuccess)}
                required
              />
            </div>
            {resetRequestError && <div role="alert" className="p-3 bg-red-50 text-red-600 text-sm border border-red-200 rounded-md">{resetRequestError}</div>}
            {resetRequestSuccess && (
              <div role="status" className="p-3 bg-green-50 text-green-700 text-sm border border-green-200 rounded-md flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>{resetRequestSuccess}</span>
              </div>
            )}
            <button type="submit" className="btn btn-primary w-full flex justify-center" disabled={isRequestingReset || Boolean(resetRequestSuccess)}>
              {isRequestingReset ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : t('auth.request_reset_wa')}
            </button>
            <button type="button" className="text-primary hover:underline text-sm bg-transparent border-none cursor-pointer font-medium" onClick={openTokenReset}>
              {t('auth.have_token')}
            </button>
          </form>
        </AccessibleDialog>
      )}

      {showRequestUnlockModal && (
        <AccessibleDialog
          titleId="unlock-request-title"
          closeLabel={t('auth.cancel')}
          onClose={() => setShowRequestUnlockModal(false)}
        >
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mb-4 border border-dashed border-red-200">
              <ShieldAlert size={24} className="text-red-500" aria-hidden="true" />
            </div>
            <h3 id="unlock-request-title" className="text-xl font-bold">{t('auth.locked_title')}</h3>
            <p className="text-sm text-gray-500 mt-2">{t('auth.locked_desc')}</p>
          </div>
          <form onSubmit={handleUnlockRequest} aria-busy={isRequestingUnlock} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="unlock-email" className="form-label text-left w-full block font-medium">{t('auth.your_email')}</label>
              <input
                id="unlock-email"
                type="email"
                autoComplete="email"
                className="form-control"
                placeholder={t('auth.registered_email_ph')}
                value={unlockEmail}
                onChange={(event) => setUnlockEmail(event.target.value)}
                disabled={isRequestingUnlock || Boolean(unlockSuccess)}
                required
              />
            </div>
            {unlockError && <div role="alert" className="p-3 bg-red-50 text-red-600 text-sm border border-red-200 rounded-md">{unlockError}</div>}
            {unlockSuccess && (
              <div role="status" className="p-3 bg-green-50 text-green-700 text-sm border border-green-200 rounded-md flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>{unlockSuccess}</span>
              </div>
            )}
            <button type="submit" className="btn btn-primary w-full flex justify-center" disabled={isRequestingUnlock || Boolean(unlockSuccess)}>
              {isRequestingUnlock ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : t('auth.send_request')}
            </button>
            <button type="button" className="text-primary hover:underline text-sm bg-transparent border-none cursor-pointer font-medium" onClick={openTokenReset}>
              {t('auth.have_token')}
            </button>
          </form>
        </AccessibleDialog>
      )}

      {showResetModal && (
        <AccessibleDialog
          titleId="reset-password-title"
          closeLabel={t('auth.back_login')}
          onClose={closeResetDialog}
        >
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4 border border-dashed border-gray-400">
              <KeyRound size={24} className="text-gray-500" aria-hidden="true" />
            </div>
            <h3 id="reset-password-title" className="text-xl font-bold">{t('auth.reset_title')}</h3>
            <p className="text-sm text-gray-500 mt-2">{t('auth.reset_desc')}</p>
          </div>
          <form onSubmit={handleResetPassword} aria-busy={isResetting} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="reset-token" className="form-label text-left w-full block">{t('auth.token_label')}</label>
              <input
                id="reset-token"
                type="text"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck="false"
                className="form-control text-center tracking-widest font-mono font-bold"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={resetToken}
                onChange={(event) => setResetToken(formatRecoveryToken(event.target.value))}
                required
                maxLength={19}
                aria-describedby="reset-token-hint"
              />
              <p id="reset-token-hint" className="mt-1.5 text-xs text-gray-500">{t('auth.token_hint')}</p>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="reset-new-password" className="form-label text-left w-full block">{t('auth.new_password')}</label>
              <input
                id="reset-new-password"
                type="password"
                autoComplete="new-password"
                className="form-control"
                placeholder={t('auth.new_password_ph')}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
                aria-describedby="new-password-hint"
              />
              <p id="new-password-hint" className="mt-1.5 text-xs text-gray-500">{t('auth.password_min', { count: MIN_PASSWORD_LENGTH })}</p>
            </div>

            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden" aria-hidden="true">
              <div className={`h-full ${Array.from(newPassword).length >= MIN_PASSWORD_LENGTH ? 'bg-green-500 w-full' : newPassword.length > 0 ? 'bg-amber-400 w-1/2' : 'bg-transparent'}`} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="reset-confirm-password" className="form-label text-left w-full block">{t('auth.confirm_password')}</label>
              <input
                id="reset-confirm-password"
                type="password"
                autoComplete="new-password"
                className="form-control"
                placeholder={t('auth.confirm_password_ph')}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
              />
            </div>

            {resetError && <div role="alert" className="p-3 bg-red-50 text-red-600 text-sm border border-red-200 rounded-md">{resetError}</div>}
            {resetSuccess && (
              <div role="status" className="p-3 bg-green-50 text-green-700 text-sm border border-green-200 rounded-md flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>{resetSuccess}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary w-full flex justify-center" disabled={isResetting || Boolean(resetSuccess)}>
              {isResetting ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : t('auth.reset_button')}
            </button>
          </form>
        </AccessibleDialog>
      )}
    </div>
  );
};

export default LoginPage;
