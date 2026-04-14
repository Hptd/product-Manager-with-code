import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getToken } from '../api/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin = false }) => {
  const location = useLocation();
  const token = getToken();

  // 未登录，重定向到登录页
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 如果需要管理员权限，检查角色
  if (requireAdmin) {
    // 这里简化处理，实际应该从用户信息中获取
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'ADMIN') {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
