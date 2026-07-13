import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import LoginPage from '../pages/auth/LoginPage';
import DashboardAdmin from '../pages/dashboard/DashboardAdmin';
import DashboardUserUnit from '../pages/dashboard/DashboardUserUnit';
import DashboardIT from '../pages/dashboard/DashboardIT';

import HistoryLaporan from '../pages/laporan/HistoryLaporan';
import InputLaporan from '../pages/laporan/InputLaporan';
import ReviewLaporan from '../pages/laporan/ReviewLaporan';

import HelpdeskPage from '../pages/helpdesk/HelpdeskPage';

import ManajemenUser from '../pages/manajemen/ManajemenUser';
import ManajemenUnit from '../pages/manajemen/ManajemenUnit';

import MonitoringPage from '../pages/monitoring/MonitoringPage';
import NotifikasiPage from '../pages/notifikasi/NotifikasiPage';
import SettingsPage from '../pages/settings/SettingsPage';
import AnalitikPage from '../pages/analitik/AnalitikPage';

import AppLayout from '../components/layout/AppLayout';

// Mock Component for Missing Pages
const DummyPage = ({ title }) => (
  <div className="p-8">
    <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
    <p className="text-gray-500 mt-2">Sedang dalam pengembangan...</p>
  </div>
);

const AppRouter = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Routes with Layout */}
      <Route element={<AppLayout />}>
        
        {/* IT Routes */}
        <Route element={<ProtectedRoute allowedRoles={['IT']} />}>
          <Route path="/dashboard/it" element={<DashboardIT />} />
          <Route path="/monitoring" element={<MonitoringPage />} />
        </Route>

        {/* ADMIN_GLOBAL Routes */}
        <Route element={<ProtectedRoute allowedRoles={['ADMIN_GLOBAL']} />}>
          <Route path="/dashboard/admin" element={<DashboardAdmin />} />
          <Route path="/laporan/review" element={<HistoryLaporan />} />
          <Route path="/laporan/review/:id" element={<ReviewLaporan />} />
          <Route path="/manajemen/user" element={<ManajemenUser />} />
          <Route path="/manajemen/unit" element={<ManajemenUnit />} />
        </Route>

        {/* USER_UNIT Routes */}
        <Route element={<ProtectedRoute allowedRoles={['USER_UNIT']} />}>
          <Route path="/dashboard/unit" element={<DashboardUserUnit />} />
          <Route path="/laporan/input" element={<InputLaporan />} />
          <Route path="/target" element={<DummyPage title="Target Saya" />} />
        </Route>

        {/* Shared Routes: Admin */}
        <Route element={<ProtectedRoute allowedRoles={['ADMIN_GLOBAL']} />}>
          <Route path="/notifikasi" element={<NotifikasiPage />} />
          <Route path="/analitik" element={<AnalitikPage />} />
        </Route>

        {/* Shared Routes: Admin & User Unit */}
        <Route element={<ProtectedRoute allowedRoles={['ADMIN_GLOBAL', 'USER_UNIT']} />}>
          <Route path="/laporan/history" element={<HistoryLaporan />} />
          <Route path="/laporan/detail/:id" element={<ReviewLaporan />} />
        </Route>

        {/* Shared Routes: All */}
        <Route element={<ProtectedRoute />}>
          <Route path="/helpdesk" element={<HelpdeskPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default AppRouter;
