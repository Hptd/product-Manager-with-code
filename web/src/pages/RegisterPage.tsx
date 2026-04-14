import React, { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi, setTokens } from '../api/client';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 密码强度校验
  const passwordStrength = {
    hasLength: password.length >= 8,
    hasLower: /[a-z]/.test(password),
    hasUpper: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password)
  };

  const isPasswordStrong = Object.values(passwordStrength).every(Boolean);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (!isPasswordStrong) {
      setError('密码不符合要求');
      return;
    }

    setLoading(true);

    try {
      const response = await authApi.register(username, email, password);
      
      if (response.success) {
        setTokens(response.data.accessToken, response.data.refreshToken);
        navigate('/');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error;
      const details = err.response?.data?.details;
      setError(details ? details.join('，') : errorMsg || '注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">创建账号</h1>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">用户名</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="3-20个字符，仅允许字母、数字和下划线"
              autoComplete="username"
              required
              pattern="[a-zA-Z0-9_]{3,20}"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">邮箱</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="输入你的邮箱"
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">密码</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="设置密码"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">确认密码</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入密码"
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
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <div className="auth-footer">
          已有账号？ <Link to="/login">返回登录</Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
