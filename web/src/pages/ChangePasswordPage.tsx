import React, { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';

const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordStrength = {
    hasLength: newPassword.length >= 8,
    hasLower: /[a-z]/.test(newPassword),
    hasUpper: /[A-Z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword)
  };

  const isPasswordStrong = Object.values(passwordStrength).every(Boolean);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (!isPasswordStrong) {
      setError('密码不符合要求');
      return;
    }

    setLoading(true);

    try {
      // 注意：这里不需要 oldPassword，因为是临时密码首次登录
      // 我们直接使用新密码覆盖
      await authApi.changePassword('', newPassword);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || '修改密码失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">首次登录，请修改密码</h1>
        <p className="auth-subtitle">
          当前使用的是临时密码，为了安全，请设置你自己的密码。
        </p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="newPassword">新密码</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="设置新密码"
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
            {loading ? '修改中...' : '确认修改'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
