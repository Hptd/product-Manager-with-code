import React, { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';
import type { User } from '../api/client';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const data = await authApi.getCurrentUser();
      setUser(data.data);
    } catch {
      navigate('/login');
    } finally {
      setLoadingUser(false);
    }
  };

  const passwordStrength = {
    hasLength: newPassword.length >= 8,
    hasLower: /[a-z]/.test(newPassword),
    hasUpper: /[A-Z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword)
  };

  const isPasswordStrong = Object.values(passwordStrength).every(Boolean);

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!oldPassword) {
      setError('请输入旧密码');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (!isPasswordStrong) {
      setError('新密码不符合要求');
      return;
    }

    setLoading(true);

    try {
      await authApi.changePassword(oldPassword, newPassword);
      setSuccess('密码修改成功');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.error || '修改密码失败');
    } finally {
      setLoading(false);
    }
  };

  if (loadingUser) {
    return <div className="profile-page">加载中...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <h1>个人资料</h1>

        <div className="profile-info">
          <h2>账号信息</h2>
          <div className="info-row">
            <label>用户名：</label>
            <span>{user.username}</span>
          </div>
          <div className="info-row">
            <label>邮箱：</label>
            <span>{user.email}</span>
          </div>
          <div className="info-row">
            <label>角色：</label>
            <span>{user.role === 'ADMIN' ? '管理员' : '普通用户'}</span>
          </div>
          <div className="info-row">
            <label>注册时间：</label>
            <span>{user.createdAt ? new Date(user.createdAt).toLocaleString('zh-CN') : '-'}</span>
          </div>
        </div>

        <div className="profile-password">
          <h2>修改密码</h2>

          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <form onSubmit={handleChangePassword} className="auth-form">
            <div className="form-group">
              <label htmlFor="oldPassword">旧密码</label>
              <input
                id="oldPassword"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="输入旧密码"
                autoComplete="current-password"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">新密码</label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="输入新密码"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">确认新密码</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="password-requirements">
              <p>密码要求：</p>
              <ul>
                <li className={passwordStrength.hasLength ? 'valid' : ''}>
                  {passwordStrength.hasLength ? '✓' : '○'} 至少8个字符
                </li>
                <li className={passwordStrength.hasLower ? 'valid' : ''}>
                  {passwordStrength.hasLower ? '✓' : '○'} 包含小写字母
                </li>
                <li className={passwordStrength.hasUpper ? 'valid' : ''}>
                  {passwordStrength.hasUpper ? '✓' : '○'} 包含大写字母
                </li>
                <li className={passwordStrength.hasNumber ? 'valid' : ''}>
                  {passwordStrength.hasNumber ? '✓' : '○'} 包含数字
                </li>
              </ul>
            </div>

            <button type="submit" className="auth-button" disabled={loading || !isPasswordStrong}>
              {loading ? '修改中...' : '修改密码'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
