import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { getToken, clearTokens, authApi } from './api/client';
import type { User } from './api/client';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import ProfilePage from './pages/ProfilePage';
import AdminUsersPage from './pages/AdminUsersPage';
import ProtectedRoute from './components/ProtectedRoute';
import App from './App';
import './pages/AuthPages.css';

// 登录状态检查组件
const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const token = getToken();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// 已登录用户重定向
const RedirectIfLoggedIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const token = getToken();
  const redirect = new URLSearchParams(location.search).get('redirect') || '/';

  if (token) {
    return <Navigate to={redirect} replace />;
  }

  return <>{children}</>;
};

// 用户信息容器 - 加载用户信息并存储到 localStorage 供路由守卫使用
const UserInfoLoader: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const response = await authApi.getCurrentUser();
      localStorage.setItem('userRole', response.data.role);
      localStorage.setItem('userId', response.data.id);
      localStorage.setItem('username', response.data.username);

      // 如果强制改密码，跳转
      if (response.data.forcePasswordChange) {
        navigate('/change-password');
        return;
      }
    } catch {
      clearTokens();
      navigate('/login');
      return;
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-screen">加载中...</div>;
  }

  return <>{children}</>;
};

const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* 公开路由 */}
        <Route path="/login" element={
          <RedirectIfLoggedIn>
            <LoginPage />
          </RedirectIfLoggedIn>
        } />
        <Route path="/register" element={
          <RedirectIfLoggedIn>
            <RegisterPage />
          </RedirectIfLoggedIn>
        } />

        {/* 强制改密码路由 */}
        <Route path="/change-password" element={
          <AuthGuard>
            <ChangePasswordPage />
          </AuthGuard>
        } />

        {/* 受保护路由 */}
        <Route path="/" element={
          <AuthGuard>
            <UserInfoLoader>
              <App />
            </UserInfoLoader>
          </AuthGuard>
        } />
        <Route path="/profile" element={
          <AuthGuard>
            <ProfilePage />
          </AuthGuard>
        } />
        <Route path="/admin/users" element={
          <AuthGuard>
            <AdminUsersPage />
          </AuthGuard>
        } />

        {/* 404 重定向 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
