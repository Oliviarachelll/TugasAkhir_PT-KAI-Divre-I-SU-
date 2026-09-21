
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  History, 

  Headset, 
  Settings, 
  LogOut,
  Users,
  Building2,
  Bell,
  Target,

  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import useAuthStore from '../../store/auth.store';
import toast from 'react-hot-toast';
import kaiLogo from '../../assets/logokai.webp';
import { useTranslation } from 'react-i18next';

const Sidebar = ({ className, isOpen, onClose, isCollapsed, toggleCollapse }) => {
  const navigate = useNavigate();
  const { user, setAuth } = useAuthStore();
  const { t } = useTranslation();

  const handleLogout = () => {
    setAuth(null, null);
    toast.success(t('toast.logout_success'));
    navigate('/login');
  };

  const navItems = {
    USER_UNIT: [
      { path: '/dashboard/unit', label: t('menu.dashboard'), icon: LayoutDashboard },
      { path: '/laporan/input', label: t('menu.input_laporan'), icon: FileText },
      { path: '/laporan/history', label: t('menu.laporan'), icon: History },
      { path: '/target', label: t('router.my_target'), icon: Target },
      { path: '/helpdesk', label: t('menu.helpdesk'), icon: Headset },
      { path: '/settings', label: t('menu.settings'), icon: Settings },
    ],
    ADMIN_GLOBAL: [
      { path: '/dashboard/admin', label: t('menu.dashboard'), icon: LayoutDashboard },
      // { path: '/analitik', label: 'Analitik', icon: Target },
      { path: '/laporan/review', label: t('menu.review_laporan'), icon: FileText },
      { path: '/manajemen/unit', label: t('menu.manajemen_unit'), icon: Building2 },
      { path: '/manajemen/user', label: t('menu.manajemen_user'), icon: Users },
      { path: '/helpdesk', label: t('menu.helpdesk'), icon: Headset },
      { path: '/notifikasi', label: t('menu.notifikasi'), icon: Bell },
      { path: '/settings', label: t('menu.settings'), icon: Settings },
    ],
    IT: [
      { path: '/dashboard/it', label: t('menu.dashboard'), icon: LayoutDashboard },
      { path: '/monitoring', label: t('menu.manajemen'), icon: Building2 },
      { path: '/helpdesk', label: t('menu.helpdesk'), icon: Headset },
      { path: '/settings', label: t('menu.settings'), icon: Settings },
    ]
  };

  const currentNav = user?.peran ? navItems[user.peran] : [];

  return (
    <aside className={`sidebar bg-[var(--sidebar)] backdrop-blur-md ${className || ''} ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`} style={{ borderRight: '1px solid var(--border)' }}>
      <div className="px-6 py-5 border-b relative flex flex-col items-start gap-4" style={{ height: '88px', justifyContent: 'center', borderColor: 'var(--border)' }}>
        <div className={`flex items-center w-full ${isCollapsed ? 'justify-center' : 'gap-4'}`}>
          <div className="flex items-center justify-center p-1.5 rounded-xl flex-shrink-0" style={{ backgroundColor: 'var(--bg-main)' }}>
            <img src={kaiLogo} alt="KAI Logo" className="h-7 w-auto object-contain" />
          </div>
          <div className={`flex flex-col flex-1 overflow-hidden transition-all duration-300 ${isCollapsed ? 'max-w-0 opacity-0' : 'max-w-[200px] opacity-100'}`}>
            <span className="text-[15px] font-bold tracking-tight leading-none truncate" style={{ color: 'var(--sidebar-active-text)' }}>PT KAI</span>
            <span className="text-xs mt-1.5 font-medium truncate" style={{ color: 'var(--sidebar-text-muted)' }}>Divre I SU</span>
          </div>
        </div>
        
        <button 
          onClick={toggleCollapse}
          className="absolute -right-3.5 top-6 rounded-xl p-1.5 border hidden md:block transition-colors shadow-sm"
          style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'var(--sidebar)', color: 'var(--sidebar-text)' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)'; e.currentTarget.style.color = 'var(--sidebar-active-text)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--sidebar)'; e.currentTarget.style.color = 'var(--sidebar-text)'; }}
        >
          {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-6">
        <ul className="space-y-1.5">
          {currentNav.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path} className="px-4">
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      isActive 
                        ? 'shadow-sm' 
                        : ''
                    } ${isCollapsed ? 'justify-center' : ''}`
                  }
                  style={({ isActive }) => ({
                    backgroundColor: isActive ? 'var(--sidebar-active)' : 'transparent',
                    color: isActive ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)'
                  })}
                  onMouseEnter={(e) => { if (!e.currentTarget.className.includes('shadow-sm')) { e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)'; e.currentTarget.style.color = 'var(--sidebar-active-text)'; } }}
                  onMouseLeave={(e) => { if (!e.currentTarget.className.includes('shadow-sm')) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--sidebar-text)'; } }}
                  onClick={onClose}
                  title={isCollapsed ? item.label : ""}
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex-shrink-0">
                        <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                      </div>
                      <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
                        {item.label}
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <ul className="px-1">
          <li>
            <button 
              onClick={handleLogout}
              className={`flex items-center px-4 py-3 rounded-xl text-sm font-semibold w-full transition-all duration-200 ${isCollapsed ? 'justify-center' : 'text-left'}`}
              style={{ color: 'var(--sidebar-text)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--danger)'; e.currentTarget.style.color = '#FFFFFF'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--sidebar-text)'; }}
              title={isCollapsed ? t('menu.logout') : ""}
            >
              <div className="flex-shrink-0">
                <LogOut size={18} strokeWidth={2} />
              </div>
              <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
                {t('menu.logout')}
              </span>
            </button>
          </li>
        </ul>
      </div>
    </aside>
  );
};

export default Sidebar;
