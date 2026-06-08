import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  History, 
  Target, 
  Headset, 
  Settings, 
  LogOut,
  Users,
  Building2,
  Bell,
  Activity
} from 'lucide-react';
import useAuthStore from '../../store/auth.store';
import toast from 'react-hot-toast';

const Sidebar = ({ className }) => {
  const navigate = useNavigate();
  const { user, setAuth } = useAuthStore();

  const handleLogout = () => {
    setAuth(null, null);
    toast.success('Berhasil keluar');
    navigate('/login');
  };

  const navItems = {
    USER_UNIT: [
      { path: '/dashboard/unit', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/laporan/input', label: 'Input Laporan', icon: FileText },
      { path: '/laporan/history', label: 'History Laporan', icon: History },
      { path: '/target', label: 'Target Saya', icon: Target },
      { path: '/helpdesk', label: 'Helpdesk', icon: Headset },
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
    ADMIN_GLOBAL: [
      { path: '/dashboard/admin', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/laporan/review', label: 'Laporan', icon: FileText },
      { path: '/laporan/history', label: 'History Laporan', icon: History },
      { path: '/manajemen/unit', label: 'Manajemen Unit', icon: Building2 },
      { path: '/manajemen/user', label: 'Manajemen User', icon: Users },
      { path: '/helpdesk', label: 'Helpdesk', icon: Headset },
      { path: '/notifikasi', label: 'Notifikasi', icon: Bell },
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
    IT: [
      { path: '/dashboard/it', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/monitoring', label: 'Monitoring Sistem', icon: Activity },
      { path: '/helpdesk', label: 'Helpdesk', icon: Headset },
      { path: '/notifikasi', label: 'Notifikasi', icon: Bell },
      { path: '/settings', label: 'Settings', icon: Settings },
    ]
  };

  const currentNav = user?.peran ? navItems[user.peran] : [];

  return (
    <aside className={`sidebar ${className || ''}`}>
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-gray-500 flex items-center justify-center text-gray-300">
            Logo
          </div>
          <span className="text-xl font-medium text-white tracking-tight">App Name</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1">
          {currentNav.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-6 py-3 text-sm font-medium ${
                      isActive 
                        ? 'bg-white/10 text-white border-l-4 border-white' 
                        : 'text-gray-400 hover:bg-white/5 hover:text-white border-l-4 border-transparent'
                    }`
                  }
                >
                  <Icon size={18} />
                  {item.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="p-4 border-t border-gray-700">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-2 py-3 text-sm font-medium text-gray-400 hover:text-white w-full text-left"
        >
          <LogOut size={18} />
          Keluar
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
