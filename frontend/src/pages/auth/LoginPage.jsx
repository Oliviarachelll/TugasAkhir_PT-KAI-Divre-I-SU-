import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  ShieldAlert,
  Loader2,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  Check,
  Sun,
  Moon,
} from 'lucide-react';
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

const LoginPage = () => {
  // Theme state: 'Terang' (Light) | 'Gelap' (Dark)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('app-theme') || (document.documentElement.getAttribute('data-theme') === 'dark' ? 'Gelap' : 'Terang');
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'Gelap' ? 'Terang' : 'Gelap';
    setTheme(nextTheme);
    localStorage.setItem('app-theme', nextTheme);
    if (nextTheme === 'Gelap') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  // Views: 'login' | 'forgot' | 'unlock'
  const [view, setView] = useState('login');
  // Sub-tabs for 'forgot' view: 'request' | 'reset'
  const [recoveryTab, setRecoveryTab] = useState('request');

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Request reset token state
  const [resetRequestEmail, setResetRequestEmail] = useState('');
  const [resetRequestError, setResetRequestError] = useState('');
  const [resetRequestSuccess, setResetRequestSuccess] = useState('');
  const [isRequestingReset, setIsRequestingReset] = useState(false);

  // Reset password with token state
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Unlock account state
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

  // --- Handlers ---
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

  const switchToForgot = (targetTab = 'request') => {
    setResetRequestEmail(email);
    setResetRequestError('');
    setResetRequestSuccess('');
    setResetError('');
    setResetSuccess('');
    setRecoveryTab(targetTab);
    setView('forgot');
  };

  const switchToUnlock = () => {
    setUnlockEmail(email);
    setUnlockError('');
    setUnlockSuccess('');
    setView('unlock');
  };

  const switchToLogin = () => {
    setErrorMsg('');
    setView('login');
  };

  const isPasswordValidLength = Array.from(newPassword).length >= MIN_PASSWORD_LENGTH;
  const isPasswordMatching = confirmPassword.length > 0 && newPassword === confirmPassword;

  return (
    <div className="login-split">
      {/* Tombol Pengubah Mode Terang / Gelap (Floating) */}
      <button
        type="button"
        className="theme-toggle-floating"
        onClick={toggleTheme}
        title={theme === 'Gelap' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
        aria-label={theme === 'Gelap' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
      >
        {theme === 'Gelap' ? <Sun size={15} /> : <Moon size={15} />}
        <span>{theme === 'Gelap' ? 'Mode Gelap' : 'Mode Terang'}</span>
      </button>

      <div className="login-form-container">
        {/* Brand Header */}
        <div className="flex justify-center mb-6">
          <div className="w-28 flex items-center justify-center">
            <img src={kaiLogo} alt="KAI Logo" className="w-full h-auto object-contain" />
          </div>
        </div>
        <div className="text-center mb-8">
          <p className="login-text text-sm font-semibold tracking-wide">
            {t('auth.subtitle')}
            <br />
            <span className="font-normal">{t('auth.company')}</span>
          </p>
        </div>

        {/* ===================== VIEW 1: LOGIN ===================== */}
        {view === 'login' && (
          <form onSubmit={handleLogin} aria-busy={isLoading} className="flex flex-col gap-4">
            {/* Email Field */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-email" className="login-text block text-sm font-medium">
                {t('auth.email')}
              </label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon">
                  <Mail size={16} />
                </span>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  className="auth-input"
                  placeholder={t('auth.email_ph')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="login-text block text-sm font-medium">
                  {t('auth.password')}
                </label>
                <button
                  type="button"
                  className="login-text-dim text-xs bg-transparent border-none cursor-pointer hover:underline p-0"
                  onClick={() => switchToForgot('request')}
                >
                  {t('auth.forgot_password')}
                </button>
              </div>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon">
                  <Lock size={16} />
                </span>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="auth-input has-action"
                  placeholder={t('auth.password_ph')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  className="auth-input-action"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? t('auth.hide_password') : t('auth.show_password')}
                  aria-label={showPassword ? t('auth.hide_password') : t('auth.show_password')}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="button"
              className="login-text-dim text-xs bg-transparent border-none cursor-pointer hover:underline self-start p-0 mt-1"
              onClick={switchToUnlock}
            >
              {t('auth.account_help')}
            </button>

            {/* Error Banner */}
            {errorMsg && (
              <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/70 dark:border-red-500/50 dark:text-red-200 rounded-lg flex items-start gap-2.5">
                <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs font-medium leading-relaxed">{errorMsg}</p>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="auth-btn-primary"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                    <span>{t('common.loading') || 'Memproses...'}</span>
                  </>
                ) : (
                  <span>{t('auth.submit')}</span>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ===================== VIEW 2: FORGOT PASSWORD / RECOVERY ===================== */}
        {view === 'forgot' && (
          <div className="flex flex-col">
            {/* Back Button */}
            <button
              type="button"
              className="login-text-dim hover:opacity-80 inline-flex items-center gap-1.5 text-xs bg-transparent border-none cursor-pointer mb-3 py-1 self-start transition-colors"
              onClick={switchToLogin}
            >
              <ArrowLeft size={16} />
              <span>{t('auth.back_to_sign_in')}</span>
            </button>

            {/* Recovery Segmented Tabs */}
            <div className="auth-tabs">
              <button
                type="button"
                className={`auth-tab-btn ${recoveryTab === 'request' ? 'active' : ''}`}
                onClick={() => setRecoveryTab('request')}
              >
                {t('auth.tab_request_token')}
              </button>
              <button
                type="button"
                className={`auth-tab-btn ${recoveryTab === 'reset' ? 'active' : ''}`}
                onClick={() => setRecoveryTab('reset')}
              >
                {t('auth.tab_input_token')}
              </button>
            </div>

            {/* Tab A: Minta Token */}
            {recoveryTab === 'request' && (
              <form onSubmit={handleResetRequest} aria-busy={isRequestingReset} className="flex flex-col gap-4">
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-500/30 dark:text-blue-200 rounded-lg text-xs leading-relaxed">
                  {t('auth.request_token_info')}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="reset-request-email" className="login-text block text-sm font-medium">
                    {t('auth.your_email')}
                  </label>
                  <div className="auth-input-wrapper">
                    <span className="auth-input-icon">
                      <Mail size={16} />
                    </span>
                    <input
                      id="reset-request-email"
                      type="email"
                      autoComplete="email"
                      className="auth-input"
                      placeholder={t('auth.registered_email_ph')}
                      value={resetRequestEmail}
                      onChange={(e) => setResetRequestEmail(e.target.value)}
                      disabled={isRequestingReset || Boolean(resetRequestSuccess)}
                      required
                    />
                  </div>
                </div>

                {resetRequestError && (
                  <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/70 dark:border-red-500/50 dark:text-red-200 rounded-lg flex items-start gap-2.5">
                    <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs font-medium leading-relaxed">{resetRequestError}</p>
                  </div>
                )}

                {resetRequestSuccess && (
                  <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 dark:bg-emerald-950/70 dark:border-emerald-500/50 dark:text-emerald-200 rounded-lg flex flex-col gap-2.5">
                    <div className="flex items-start gap-2 text-xs font-medium leading-relaxed">
                      <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{resetRequestSuccess}</span>
                    </div>
                    <button
                      type="button"
                      className="mt-1 w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold border-none cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                      onClick={() => setRecoveryTab('reset')}
                    >
                      <span>{t('auth.proceed_to_token')}</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  className="auth-btn-primary"
                  disabled={isRequestingReset || Boolean(resetRequestSuccess)}
                >
                  {isRequestingReset ? (
                    <>
                      <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                      <span>{t('common.loading') || 'Mengirim...'}</span>
                    </>
                  ) : (
                    <span>{t('auth.request_reset_wa')}</span>
                  )}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    className="login-text-dim hover:underline text-xs bg-transparent border-none cursor-pointer transition-colors"
                    onClick={() => setRecoveryTab('reset')}
                  >
                    {t('auth.have_token')}
                  </button>
                </div>
              </form>
            )}

            {/* Tab B: Input Token & Reset Sandi */}
            {recoveryTab === 'reset' && (
              <form onSubmit={handleResetPassword} aria-busy={isResetting} className="flex flex-col gap-3.5">
                <div className="p-3 bg-slate-100 border border-slate-200 text-slate-700 dark:bg-slate-900/60 dark:border-slate-700/60 dark:text-slate-300 rounded-lg text-xs leading-relaxed">
                  {t('auth.input_token_info')}
                </div>

                {/* Token Input */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="reset-token" className="login-text block text-sm font-medium">
                      {t('auth.token_label')}
                    </label>
                    <span className="text-[11px] login-text-dim font-mono">16 Karakter</span>
                  </div>
                  <div className="auth-input-wrapper">
                    <span className="auth-input-icon">
                      <KeyRound size={16} />
                    </span>
                    <input
                      id="reset-token"
                      type="text"
                      autoComplete="one-time-code"
                      autoCapitalize="characters"
                      spellCheck="false"
                      className="auth-input font-mono tracking-widest text-center font-bold"
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      value={resetToken}
                      onChange={(e) => setResetToken(formatRecoveryToken(e.target.value))}
                      required
                      maxLength={19}
                    />
                  </div>
                </div>

                {/* New Password */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="reset-new-password" className="login-text block text-sm font-medium">
                    {t('auth.new_password')}
                  </label>
                  <div className="auth-input-wrapper">
                    <span className="auth-input-icon">
                      <Lock size={16} />
                    </span>
                    <input
                      id="reset-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      className="auth-input has-action"
                      placeholder={t('auth.new_password_ph')}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={MIN_PASSWORD_LENGTH}
                    />
                    <button
                      type="button"
                      className="auth-input-action"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      title={showNewPassword ? t('auth.hide_password') : t('auth.show_password')}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {/* Validation indicator */}
                  <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
                    <span className={`inline-flex items-center gap-1 ${isPasswordValidLength ? 'text-emerald-600 font-semibold' : 'login-text-dim'}`}>
                      {isPasswordValidLength ? <Check size={13} /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />}
                      {t('auth.password_min', { count: MIN_PASSWORD_LENGTH })}
                    </span>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="reset-confirm-password" className="login-text block text-sm font-medium">
                    {t('auth.confirm_password')}
                  </label>
                  <div className="auth-input-wrapper">
                    <span className="auth-input-icon">
                      <Lock size={16} />
                    </span>
                    <input
                      id="reset-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      className="auth-input has-action"
                      placeholder={t('auth.confirm_password_ph')}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={MIN_PASSWORD_LENGTH}
                    />
                    <button
                      type="button"
                      className="auth-input-action"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      title={showConfirmPassword ? t('auth.hide_password') : t('auth.show_password')}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
                      <span className={`inline-flex items-center gap-1 font-medium ${isPasswordMatching ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {isPasswordMatching ? <Check size={13} /> : <AlertCircle size={13} />}
                        {isPasswordMatching ? t('auth.password_match') : t('auth.password_not_match')}
                      </span>
                    </div>
                  )}
                </div>

                {resetError && (
                  <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/70 dark:border-red-500/50 dark:text-red-200 rounded-lg flex items-start gap-2.5">
                    <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs font-medium leading-relaxed">{resetError}</p>
                  </div>
                )}

                {resetSuccess && (
                  <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 dark:bg-emerald-950/70 dark:border-emerald-500/50 dark:text-emerald-200 rounded-lg flex flex-col gap-2.5">
                    <div className="flex items-start gap-2 text-xs font-medium leading-relaxed">
                      <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{resetSuccess}</span>
                    </div>
                    <button
                      type="button"
                      className="mt-1 w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold border-none cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                      onClick={switchToLogin}
                    >
                      <span>{t('auth.back_to_sign_in')}</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  className="auth-btn-primary mt-1"
                  disabled={isResetting || Boolean(resetSuccess)}
                >
                  {isResetting ? (
                    <>
                      <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                      <span>{t('common.loading') || 'Menyimpan...'}</span>
                    </>
                  ) : (
                    <span>{t('auth.reset_button')}</span>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ===================== VIEW 3: UNLOCK ACCOUNT ===================== */}
        {view === 'unlock' && (
          <div className="flex flex-col">
            {/* Back Button */}
            <button
              type="button"
              className="login-text-dim hover:opacity-80 inline-flex items-center gap-1.5 text-xs bg-transparent border-none cursor-pointer mb-3 py-1 self-start transition-colors"
              onClick={switchToLogin}
            >
              <ArrowLeft size={16} />
              <span>{t('auth.back_to_sign_in')}</span>
            </button>

            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/15 text-amber-500 mb-2">
                <ShieldAlert size={22} />
              </div>
              <h2 className="login-text text-base font-semibold">
                {t('auth.locked_title')}
              </h2>
              <p className="login-text-dim text-xs mt-1 leading-relaxed">
                {t('auth.locked_desc')}
              </p>
            </div>

            <form onSubmit={handleUnlockRequest} aria-busy={isRequestingUnlock} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="unlock-email" className="login-text block text-sm font-medium">
                  {t('auth.your_email')}
                </label>
                <div className="auth-input-wrapper">
                  <span className="auth-input-icon">
                    <Mail size={16} />
                  </span>
                  <input
                    id="unlock-email"
                    type="email"
                    autoComplete="email"
                    className="auth-input"
                    placeholder={t('auth.registered_email_ph')}
                    value={unlockEmail}
                    onChange={(e) => setUnlockEmail(e.target.value)}
                    disabled={isRequestingUnlock || Boolean(unlockSuccess)}
                    required
                  />
                </div>
              </div>

              {unlockError && (
                <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/70 dark:border-red-500/50 dark:text-red-200 rounded-lg flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs font-medium leading-relaxed">{unlockError}</p>
                </div>
              )}

              {unlockSuccess && (
                <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 dark:bg-emerald-950/70 dark:border-emerald-500/50 dark:text-emerald-200 rounded-lg flex flex-col gap-2.5">
                  <div className="flex items-start gap-2 text-xs font-medium leading-relaxed">
                    <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span>{unlockSuccess}</span>
                  </div>
                  <button
                    type="button"
                    className="mt-1 w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold border-none cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                    onClick={() => switchToForgot('reset')}
                  >
                    <span>{t('auth.have_token')}</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}

              <button
                type="submit"
                className="auth-btn-primary"
                disabled={isRequestingUnlock || Boolean(unlockSuccess)}
              >
                {isRequestingUnlock ? (
                  <>
                    <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                    <span>{t('common.loading') || 'Mengirim...'}</span>
                  </>
                ) : (
                  <span>{t('auth.send_request')}</span>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  className="login-text-dim hover:underline text-xs bg-transparent border-none cursor-pointer transition-colors"
                  onClick={() => switchToForgot('reset')}
                >
                  {t('auth.have_token')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Footer info */}
        <div className="login-text-dim mt-8 text-center text-xs font-medium">
          © {new Date().getFullYear()} {t('auth.footer')}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
