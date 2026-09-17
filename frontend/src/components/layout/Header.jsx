
import { useLocation } from 'react-router-dom';
import useAuthStore from '../../store/auth.store';
import { useTranslation } from 'react-i18next';
import { Menu } from 'lucide-react';

const Header = ({ onMenuClick }) => {
  const location = useLocation();
  const { user } = useAuthStore();
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'id' ? 'en' : 'id';
    i18n.changeLanguage(newLang);
  };

  // Determine the title based on the route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('dashboard/it')) return t('header.dashboard_it');
    if (path.includes('dashboard/admin')) return t('header.dashboard_admin');
    if (path.includes('dashboard/unit')) return t('header.dashboard_unit');
    if (path.includes('manajemen/user')) return t('header.manajemen_user');
    if (path.includes('manajemen/unit')) return t('header.manajemen_unit');
    if (path.includes('laporan/review')) return t('header.review_laporan');
    if (path.includes('laporan/history')) return t('header.history_laporan');
    if (path.includes('laporan/input')) return t('header.input_laporan');
    if (path.includes('monitoring')) return t('header.monitoring');
    if (path.includes('helpdesk')) return t('header.helpdesk');
    if (path.includes('notifikasi')) return t('header.notifikasi');
    if (path.includes('settings')) return t('header.settings');
    if (path.includes('analitik')) return t('header.analitik');
    return t('header.dashboard');
  };

  const userName = user?.nama || t('header.user_fallback');
  const userRole = user?.peran === 'IT' ? t('header.role_it') 
                 : user?.peran === 'ADMIN_GLOBAL' ? t('header.role_admin') 
                 : user?.unit?.nama_unit || t('header.role_division');

  // Extract initials for the avatar (e.g. "IT" from "IT Support" or "NA" from "Nama")
  const getInitials = (name) => {
    const names = name.split(' ');
    if (names.length >= 2) return (names[0][0] + names[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="app-header h-[80px] border-b flex items-center justify-between px-8 shrink-0 z-30 backdrop-blur-md" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="header-title-group flex items-center flex-1 min-w-0">
        <button type="button" className="mobile-menu-button" onClick={onMenuClick} aria-label={t('header.open_menu')}>
          <Menu size={22} />
        </button>
        <h1 className="header-page-title text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{getPageTitle()}</h1>
      </div>

      <div className="header-actions flex items-center gap-4">
        <button 
          onClick={toggleLanguage}
          className="btn btn-secondary px-3 py-1.5 text-xs font-bold"
          style={{ minWidth: '40px', borderRadius: '8px' }}
        >
          {i18n.language === 'id' ? 'ID' : 'EN'}
        </button>
        <div className="header-user-copy text-right">
          <div className="header-user-name text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{userName}</div>
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{userRole}</div>
        </div>
        <div className="w-10 h-10 rounded-full border flex items-center justify-center font-medium text-sm" style={{ backgroundColor: 'var(--bg-card-2)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
          {getInitials(userName)}
        </div>
      </div>
    </header>
  );
};

export default Header;
