import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, clearTokens } from '../api/client';

interface UserHeaderProps {
  onLogout: () => void;
}

const UserHeader: React.FC<UserHeaderProps> = ({ onLogout }) => {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUsername(localStorage.getItem('username') || '用户');
    setRole(localStorage.getItem('userRole') || 'USER');

    // 点击外部关闭菜单
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      clearTokens();
      localStorage.removeItem('userRole');
      localStorage.removeItem('userId');
      localStorage.removeItem('username');
      onLogout();
      navigate('/login');
    }
  };

  const getInitial = () => {
    return username.charAt(0).toUpperCase();
  };

  const getAvatarColor = () => {
    const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140'];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="user-header" ref={menuRef}>
      <div
        className="user-info"
        onClick={() => setShowMenu(!showMenu)}
        title={username}
      >
        <div
          className="user-avatar"
          style={{ backgroundColor: getAvatarColor() }}
        >
          {getInitial()}
        </div>
        <span className="user-name">{username}</span>
        <span className="dropdown-arrow">{showMenu ? '▲' : '▼'}</span>
      </div>

      {showMenu && (
        <div className="user-dropdown">
          <div className="dropdown-item" onClick={() => { navigate('/profile'); setShowMenu(false); }}>
            👤 个人资料
          </div>
          <div className="dropdown-item" onClick={() => { navigate('/change-password'); setShowMenu(false); }}>
            🔑 修改密码
          </div>
          {role === 'ADMIN' && (
            <div className="dropdown-item" onClick={() => { navigate('/admin/users'); setShowMenu(false); }}>
              ⚙️ 用户管理
            </div>
          )}
          <div className="dropdown-divider"></div>
          <div className="dropdown-item logout" onClick={handleLogout}>
            🚪 退出登录
          </div>
        </div>
      )}
    </div>
  );
};

export default UserHeader;
