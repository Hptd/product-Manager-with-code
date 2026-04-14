import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersApi, getToken } from '../api/client';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  projectCount: number;
  lastLoginAt: string | null;
  createdAt: string;
  forcePasswordChange: boolean;
}

const AdminUsersPage: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // 重置密码弹窗
  const [resetModal, setResetModal] = useState<{ open: boolean; user: User | null; tempPassword: string }>({
    open: false,
    user: null,
    tempPassword: ''
  });

  // 删除确认弹窗
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; user: User | null }>({
    open: false,
    user: null
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // 检查管理员权限
    const role = localStorage.getItem('userRole');
    if (role !== 'ADMIN') {
      navigate('/');
      return;
    }
    loadUsers();
  }, [page, search]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await usersApi.getUsers(page, 20, search || undefined);
      setUsers(res.data.users);
      setTotalPages(res.data.pagination.totalPages);
    } catch {
      setError('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadUsers();
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await usersApi.updateUser(userId, { role: newRole });
      setSuccess('角色已更新');
      loadUsers();
    } catch {
      setError('更新角色失败');
    }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      await usersApi.updateUser(userId, { status: newStatus });
      setSuccess('状态已更新');
      loadUsers();
    } catch {
      setError('更新状态失败');
    }
  };

  const handleResetPassword = async (user: User) => {
    try {
      const res = await usersApi.resetPassword(user.id);
      setResetModal({
        open: true,
        user,
        tempPassword: res.data.tempPassword
      });
    } catch {
      setError('重置密码失败');
    }
  };

  const handleDeleteUser = async (user: User) => {
    try {
      await usersApi.deleteUser(user.id);
      setSuccess(`用户 ${user.username} 已删除`);
      setDeleteModal({ open: false, user: null });
      loadUsers();
    } catch {
      setError('删除用户失败');
    }
  };

  const closeResetModal = () => {
    setResetModal({ open: false, user: null, tempPassword: '' });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ open: false, user: null });
  };

  const copyTempPassword = () => {
    navigator.clipboard.writeText(resetModal.tempPassword);
    setSuccess('临时密码已复制到剪贴板');
  };

  const statusLabels: Record<string, string> = {
    ACTIVE: '正常',
    LOCKED: '锁定',
    DISABLED: '禁用'
  };

  const statusColors: Record<string, string> = {
    ACTIVE: '#28a745',
    LOCKED: '#ffc107',
    DISABLED: '#dc3545'
  };

  if (loading && users.length === 0) {
    return <div className="admin-page">加载中...</div>;
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="admin-header">
          <h1>用户管理</h1>
          <button className="btn-back" onClick={() => navigate('/')}>
            ← 返回首页
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        {/* 搜索栏 */}
        <form onSubmit={handleSearch} className="admin-search">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索用户名或邮箱..."
          />
          <button type="submit">搜索</button>
        </form>

        {/* 用户列表 */}
        <table className="admin-table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>邮箱</th>
              <th>角色</th>
              <th>项目数</th>
              <th>最后登录</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td>
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                  >
                    <option value="USER">普通用户</option>
                    <option value="ADMIN">管理员</option>
                  </select>
                </td>
                <td>{user.projectCount}</td>
                <td>
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleString('zh-CN')
                    : '从未登录'}
                </td>
                <td>
                  <span
                    className="status-badge"
                    style={{ backgroundColor: statusColors[user.status] }}
                  >
                    {statusLabels[user.status]}
                  </span>
                </td>
                <td className="actions-cell">
                  <button
                    className="btn-action btn-reset"
                    onClick={() => handleResetPassword(user)}
                    title="重置密码"
                  >
                    🔑 重置密码
                  </button>
                  <button
                    className="btn-action btn-toggle-status"
                    onClick={() =>
                      handleStatusChange(
                        user.id,
                        user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
                      )
                    }
                    title={user.status === 'ACTIVE' ? '禁用' : '启用'}
                  >
                    {user.status === 'ACTIVE' ? '🚫 禁用' : '✅ 启用'}
                  </button>
                  <button
                    className="btn-action btn-delete"
                    onClick={() => setDeleteModal({ open: true, user })}
                    title="删除"
                  >
                    🗑️ 删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="admin-pagination">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              上一页
            </button>
            <span>
              第 {page} 页 / 共 {totalPages} 页
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              下一页
            </button>
          </div>
        )}

        {/* 重置密码弹窗 */}
        {resetModal.open && resetModal.user && (
          <div className="modal-overlay" onClick={closeResetModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>密码已重置</h3>
              <div className="modal-body">
                <p>用户 <strong>{resetModal.user.username}</strong> 的密码已重置。</p>
                <p>临时密码：</p>
                <div className="temp-password">
                  <code>{resetModal.tempPassword}</code>
                  <button onClick={copyTempPassword}>📋 复制</button>
                </div>
                <p className="warning">
                  ⚠️ 该密码仅显示一次，请立即告知用户并妥善保管。<br />
                  用户首次登录时必须修改密码。
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn-confirm" onClick={closeResetModal}>
                  我已记录，关闭
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 删除确认弹窗 */}
        {deleteModal.open && deleteModal.user && (
          <div className="modal-overlay" onClick={closeDeleteModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>确认删除用户</h3>
              <div className="modal-body">
                <p>
                  确定要删除用户 <strong>{deleteModal.user.username}</strong> 吗？
                </p>
                <p className="warning">
                  ⚠️ 此操作将永久删除该用户及其所有项目文件，不可恢复！
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn-cancel" onClick={closeDeleteModal}>
                  取消
                </button>
                <button
                  className="btn-confirm btn-delete"
                  onClick={() => handleDeleteUser(deleteModal.user!)}
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsersPage;
