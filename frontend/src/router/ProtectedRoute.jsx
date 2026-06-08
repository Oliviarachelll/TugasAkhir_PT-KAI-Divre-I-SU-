import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../store/auth.store';

const ProtectedRoute = ({ allowedRoles }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.peran)) {
    // Redirect to default dashboard based on role if they try to access unauthorized page
    if (user.peran === 'IT') return <Navigate to="/dashboard/it" replace />;
    if (user.peran === 'ADMIN_GLOBAL') return <Navigate to="/dashboard/admin" replace />;
    return <Navigate to="/dashboard/unit" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
