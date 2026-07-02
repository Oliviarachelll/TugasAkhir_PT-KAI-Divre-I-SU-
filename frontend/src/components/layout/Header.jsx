import React from 'react';
import { useLocation } from 'react-router-dom';
import useAuthStore from '../../store/auth.store';
import { useTranslation } from 'react-i18next';

const Header = () => {
  const location = useLocation();
  const { user } = useAuthStore();
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'id' ? 'en' : 'id';
    i18n.changeLanguage(newLang);
  };

  // Determine the title based on the route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('dashboard/it')) return 'Dashboard IT Support';
    if (path.includes('dashboard/admin')) return 'Dashboard Admin Global';
    if (path.includes('dashboard/unit')) return 'Dashboard Unit';
    if (path.includes('manajemen/user')) return 'Manajemen User';
    if (path.includes('manajemen/unit')) return 'Manajemen Unit';
    if (path.includes('laporan/review')) return 'Review Laporan';
    if (path.includes('laporan/history')) return 'History Laporan';
    if (path.includes('laporan/input')) return 'Input Laporan';
    if (path.includes('monitoring')) return 'Monitoring Sistem';
    if (path.includes('helpdesk')) return 'Helpdesk';
    if (path.includes('notifikasi')) return 'Notifikasi';
    if (path.includes('settings')) return 'Settings';
    if (path.includes('analitik')) return 'Analitik & Grafik';
    return 'Dashboard';
  };

  const userName = user?.nama || 'Nama Pengguna';
  const userRole = user?.peran === 'IT' ? 'IT Support' 
                 : user?.peran === 'ADMIN_GLOBAL' ? 'Admin Pusat' 
                 : user?.unit?.nama_unit || 'Divisi';

  // Extract initials for the avatar (e.g. "IT" from "IT Support" or "NA" from "Nama")
  const getInitials = (name) => {
    const names = name.split(' ');
    if (names.length >= 2) return (names[0][0] + names[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="h-[80px] border-b flex items-center justify-between px-8 shrink-0 z-30" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="flex-1">
        <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{getPageTitle()}</h1>
      </div>

      <div className="flex items-center gap-4">
        <button 
          onClick={toggleLanguage}
          className="btn btn-secondary px-3 py-1.5 text-xs font-bold"
          style={{ minWidth: '40px', borderRadius: '8px' }}
        >
          {i18n.language === 'id' ? 'ID' : 'EN'}
        </button>
        <div className="text-right">
          <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{userName}</div>
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
