import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { ShieldAlert, Loader2, KeyRound, ChevronLeft, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/auth.store';
import apiClient, { API_ERROR_TOAST_ID } from '../../api/client';
import kaiLogo from '../../assets/logokai.webp';
import { useTranslation } from 'react-i18next';



const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLocked, setIsLocked] = useState(false);

  const [showResetModal, setShowResetModal] = useState(false);
  const [showRequestUnlockModal, setShowRequestUnlockModal] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const [unlockEmail, setUnlockEmail] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlockSuccess, setUnlockSuccess] = useState('');
  const [isRequestingUnlock, setIsRequestingUnlock] = useState(false);

  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuthStore();
  const { t } = useTranslation();

  // Jika sudah login, redirect sesuai role
  if (isAuthenticated && user) {
    if (user.peran === 'IT') return <Navigate to="/dashboard/it" replace />;
    if (user.peran === 'ADMIN_GLOBAL') return <Navigate to="/dashboard/admin" replace />;
    return <Navigate to="/dashboard/unit" replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLocked(false);
    
    if (!email || !password) {
      setErrorMsg(t('auth.required'));
      return;
    }

    setIsLoading(true);

    try {
      await login(email, password);
      toast.success(t('auth.login_success'));
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.message || t('auth.server_error');
      
      if (status === 403 || message.toLowerCase().includes('terkunci')) {
        setIsLocked(true);
        setErrorMsg(message);
      } else {
        setErrorMsg(message);
      }
      // Jangan tampilkan toast jika terkunci agar user fokus ke kotak kuning
      if (status !== 403) toast.error(t('auth.login_fail'), { id: API_ERROR_TOAST_ID });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTokenChange = (e) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (val.length > 2) {
      val = val.substring(0, 2) + '-' + val.substring(2, 8);
    }
    setResetToken(val);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    if (newPassword !== confirmPassword) {
      setResetError(t('auth.confirm_mismatch'));
      return;
    }

    setIsResetting(true);
    try {
      const res = await apiClient.post('/auth/reset-password', {
        token: resetToken,
        kata_sandi_baru: newPassword
      });
      setResetSuccess(res.message || t('auth.reset_success_fallback'));
      setTimeout(() => {
        setShowResetModal(false);
        setResetToken('');
        setNewPassword('');
        setConfirmPassword('');
        setResetSuccess('');
      }, 3000);
    } catch (error) {
      setResetError(error.response?.data?.message || t('auth.reset_fail'));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="login-split">
      <div className="login-form-container">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center p-3 shadow-lg">
            <img src={kaiLogo} alt="KAI Logo" className="w-full h-full object-contain" />
          </div>
        </div>
        <div className="text-center mb-8">
          <p className="login-text text-sm font-medium">{t('auth.subtitle')}<br/>{t('auth.company')}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="login-text block text-sm font-medium mb-1.5">{t('auth.email')}</label>
            <input
              type="email"
              className="form-control text-slate-900 placeholder:text-slate-500 focus:border-purple-500 transition-colors"
              placeholder={t('auth.email_ph')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="login-text block text-sm font-medium mb-1.5">{t('auth.password')}</label>
            <input
              type="password"
              className="form-control text-slate-900 placeholder:text-slate-500 focus:border-purple-500 transition-colors"
              placeholder={t('auth.password_ph')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>
            
          <p className="login-text-dim text-sm mt-1">{t('auth.hint')}</p>

          {/* Error State */}
          {errorMsg && !isLocked && (
            <div className="p-4 rounded-md" style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '6px' }}>
              <p className="text-sm text-red-200">{errorMsg}</p>
            </div>
          )}

          {/* Locked State */}
          {isLocked && (
            <div className="p-4 rounded-md" style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.2)', border: '1px solid rgba(245, 158, 11, 0.5)', borderRadius: '6px' }}>
              <div className="flex gap-3" style={{ display: 'flex', gap: '12px' }}>
                <ShieldAlert className="text-amber-400 flex-shrink-0" size={20} />
                <div>
                  <p className="text-sm text-amber-200 mb-3 font-medium">
                    {errorMsg}
                  </p>
                  <button 
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#111827', border: 'none' }}
                    onClick={() => {
                      setUnlockEmail(email);
                      setShowRequestUnlockModal(true);
                    }}
                  >
                    {t('auth.help_it')}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              className="btn w-full bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 hover:opacity-90 text-white border-none py-2.5 rounded-lg shadow-lg shadow-purple-500/30 transition-all font-semibold"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="animate-spin mx-auto" size={18} /> : t('auth.submit')}
            </button>
          </div>
          
        </form>
        
        <div className="login-text-dim mt-8 text-center text-xs font-medium">
          © {new Date().getFullYear()} {t('auth.footer')}
        </div>
      </div>

      {/* Request Unlock Modal */}
      {showRequestUnlockModal && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50 }}>
          <div className="modal bg-white rounded-xl shadow-xl" style={{ width: '450px', maxWidth: '90%', padding: '32px', backgroundColor: 'var(--bg-modal)' }}>
            <button 
              type="button"
              className="text-gray-500 hover:text-gray-900 mb-6 flex items-center gap-1 text-sm bg-transparent border-none cursor-pointer p-0"
              onClick={() => {
                setShowRequestUnlockModal(false);
                setUnlockError('');
                setUnlockSuccess('');
              }}
            >
              <ChevronLeft size={16} /> {t('auth.cancel')}
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mb-4 border border-dashed border-red-200">
                <ShieldAlert size={24} className="text-red-500" />
              </div>
              <h3 className="text-xl font-bold">{t('auth.locked_title')}</h3>
              <p className="text-sm text-gray-500 mt-2">{t('auth.locked_desc')}</p>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              setUnlockError('');
              setUnlockSuccess('');
              setIsRequestingUnlock(true);
              try {
                const res = await apiClient.post('/auth/request-unlock-ticket', { email: unlockEmail });
                setUnlockSuccess(res.message || t('auth.request_sent_fallback'));
              } catch (err) {
                setUnlockError(err.response?.data?.message || t('auth.request_fail'));
              } finally {
                setIsRequestingUnlock(false);
              }
            }} className="space-y-4" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label text-left w-full block font-medium">{t('auth.your_email')}</label>
                <input 
                  type="email" 
                  className="form-control" 
                  placeholder={t('auth.registered_email_ph')}
                  value={unlockEmail}
                  onChange={(e) => setUnlockEmail(e.target.value)}
                  required
                />
              </div>

              {unlockError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm border border-red-200 rounded-md text-left">
                  {unlockError}
                </div>
              )}

              {unlockSuccess && (
                <div className="p-3 bg-green-50 text-green-700 text-sm border border-green-200 rounded-md flex items-start gap-2 text-left">
                  <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{unlockSuccess}</span>
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-primary w-full flex justify-center"
                disabled={isRequestingUnlock || !!unlockSuccess}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {isRequestingUnlock ? <Loader2 className="animate-spin" size={18} /> : t('auth.send_request')}
              </button>

              <div className="text-center mt-4">
                <button 
                  type="button" 
                  className="text-primary hover:underline text-sm bg-transparent border-none cursor-pointer font-medium"
                  onClick={() => {
                    setShowRequestUnlockModal(false);
                    setShowResetModal(true);
                  }}
                >
                  {t('auth.have_token')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal (Popup) */}
      {showResetModal && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50 }}>
          <div className="modal bg-white rounded-xl shadow-xl" style={{ width: '450px', maxWidth: '90%', padding: '32px', backgroundColor: 'var(--bg-modal)' }}>
            <button 
              type="button"
              className="text-gray-500 hover:text-gray-900 mb-6 flex items-center gap-1 text-sm bg-transparent border-none cursor-pointer p-0"
              onClick={() => setShowResetModal(false)}
            >
              <ChevronLeft size={16} /> {t('auth.back_login')}
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4 border border-dashed border-gray-400">
                <KeyRound size={24} className="text-gray-400" />
              </div>
              <h3 className="text-xl font-bold">{t('auth.reset_title')}</h3>
              <p className="text-sm text-gray-500 mt-2">{t('auth.reset_desc')}</p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label text-left w-full block">{t('auth.token_label')}</label>
                <input 
                  type="text" 
                  className="form-control text-center tracking-widest font-mono font-bold" 
                  placeholder="XX-XXXXXX"
                  value={resetToken}
                  onChange={handleTokenChange}
                  required
                  maxLength={9}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label text-left w-full block">{t('auth.new_password')}</label>
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder={t('auth.new_password_ph')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              {/* Indikator Kekuatan Password */}
              <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full ${newPassword.length > 5 ? 'bg-green-500 w-full' : newPassword.length > 0 ? 'bg-amber-400 w-1/2' : 'bg-transparent'}`}></div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label text-left w-full block">{t('auth.confirm_password')}</label>
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder={t('auth.confirm_password_ph')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              {resetError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm border border-red-200 rounded-md text-left">
                  [Error] {resetError}
                </div>
              )}

              {resetSuccess && (
                <div className="p-3 bg-green-50 text-green-700 text-sm border border-green-200 rounded-md flex items-start gap-2 text-left">
                  <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                  <span>[Success] {resetSuccess}</span>
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-primary w-full flex justify-center"
                disabled={isResetting || !!resetSuccess}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {isResetting ? <Loader2 className="animate-spin" size={18} /> : t('auth.reset_button')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
