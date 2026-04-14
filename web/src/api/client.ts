import axios, { AxiosError } from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// 认证相关接口
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
  avatarUrl?: string;
  forcePasswordChange?: boolean;
  lastLoginAt?: string;
  createdAt?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
}

// Token 管理
const TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// 创建 Axios 实例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器 - 自动附加 Token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 是否正在刷新 Token
let isRefreshing = false;
// 等待刷新的请求队列
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

// 处理队列
const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// 响应拦截器 - 处理 401 自动刷新
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 如果是 401 且不是刷新 Token 请求本身
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url?.includes('/refresh-token')) {
        // 刷新 Token 也失败了，清除 token 并跳转登录
        clearTokens();
        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // 正在刷新，加入等待队列
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getRefreshToken();

      if (!refreshToken) {
        clearTokens();
        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
        const newAccessToken = data.data.accessToken;
        
        setTokens(newAccessToken, refreshToken);
        processQueue(null, newAccessToken);
        
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(error as AxiosError, null);
        clearTokens();
        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// 认证 API
export const authApi = {
  // 注册
  async register(username: string, email: string, password: string): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/register', {
      username,
      email,
      password
    });
    return data;
  },

  // 登录
  async login(username: string, password: string): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', {
      username,
      password
    });
    return data;
  },

  // 登出
  async logout() {
    const refreshToken = getRefreshToken();
    try {
      await apiClient.post('/auth/logout', { refreshToken });
    } finally {
      clearTokens();
    }
  },

  // 获取当前用户信息
  async getCurrentUser(): Promise<{ success: boolean; data: User }> {
    const { data } = await apiClient.get('/auth/me');
    return data;
  },

  // 修改密码
  async changePassword(oldPassword: string, newPassword: string) {
    const { data } = await apiClient.post('/auth/change-password', {
      oldPassword,
      newPassword
    });
    return data;
  }
};

// 用户管理 API (Admin)
export const usersApi = {
  // 获取用户列表
  async getUsers(page = 1, limit = 20, search?: string) {
    const { data } = await apiClient.get('/users', {
      params: { page, limit, search }
    });
    return data;
  },

  // 获取用户详情
  async getUser(id: string) {
    const { data } = await apiClient.get(`/users/${id}`);
    return data;
  },

  // 更新用户信息
  async updateUser(id: string, updates: { role?: string; status?: string }) {
    const { data } = await apiClient.put(`/users/${id}`, updates);
    return data;
  },

  // 删除用户
  async deleteUser(id: string) {
    const { data } = await apiClient.delete(`/users/${id}`);
    return data;
  },

  // 重置密码
  async resetPassword(userId: string) {
    const { data } = await apiClient.post(`/auth/reset-password/${userId}`);
    return data;
  }
};

export { apiClient };

// 保留原有接口兼容性
export const api = {
  // ... 原有的 API 调用，现在会自动附加 Token
  async getProjects() {
    const { data } = await apiClient.get('/projects');
    return data.projects;
  },

  async getFiles(projectName: string = 'project-1') {
    const { data } = await apiClient.get('/files', {
      params: { project: projectName }
    });
    return data.files;
  },

  async getFileContent(projectName: string, filePath: string) {
    const { data } = await apiClient.get('/file', {
      params: { project: projectName, path: filePath }
    });
    return data.content;
  },

  async saveFile(projectName: string, filePath: string, content: string) {
    await apiClient.post('/file', {
      project: projectName,
      path: filePath,
      content
    });
  },

  async createFolder(projectName: string, folderPath: string) {
    await apiClient.post('/folder', {
      project: projectName,
      path: folderPath
    });
  },

  async createFile(projectName: string, filePath: string, content?: string) {
    await apiClient.post('/create-file', {
      project: projectName,
      path: filePath,
      content
    });
  },

  async deleteItem(projectName: string, itemPath: string) {
    await apiClient.delete('/item', {
      params: { project: projectName, path: itemPath }
    });
  },

  async renameItem(projectName: string, oldPath: string, newPath: string) {
    await apiClient.post('/rename', {
      project: projectName,
      oldPath,
      newPath
    });
  },

  async uploadFiles(projectName: string, files: FileList, targetPath?: string) {
    const formData = new FormData();
    formData.append('project', projectName);
    if (targetPath) {
      formData.append('path', targetPath);
    }

    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    const { data } = await apiClient.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    return data.files;
  },

  async createProject(name: string) {
    const { data } = await apiClient.post('/projects', { name });
    return data.project;
  },

  async deleteProject(name: string) {
    await apiClient.delete(`/projects/${name}`);
  },

  async getResourceFiles(projectName: string, paths: string[]) {
    const { data } = await apiClient.post('/files/batch', {
      project: projectName,
      paths
    });
    return data.files;
  }
};
