import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

export interface FileItem {
  path: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileItem[];
}

export interface Project {
  name: string;
  path: string;
}

export const api = {
  // 获取项目列表
  async getProjects(): Promise<Project[]> {
    const response = await axios.get(`${API_BASE_URL}/projects`);
    return response.data.projects;
  },

  // 获取文件列表
  async getFiles(projectName: string = 'project-1'): Promise<FileItem[]> {
    const response = await axios.get(`${API_BASE_URL}/files`, {
      params: { project: projectName }
    });
    return response.data.files;
  },

  // 读取文件内容
  async getFileContent(projectName: string, filePath: string): Promise<string> {
    const response = await axios.get(`${API_BASE_URL}/file`, {
      params: { project: projectName, path: filePath }
    });
    return response.data.content;
  },

  // 保存文件
  async saveFile(projectName: string, filePath: string, content: string): Promise<void> {
    await axios.post(`${API_BASE_URL}/file`, {
      project: projectName,
      path: filePath,
      content
    });
  },

  // 创建文件夹
  async createFolder(projectName: string, folderPath: string): Promise<void> {
    await axios.post(`${API_BASE_URL}/folder`, {
      project: projectName,
      path: folderPath
    });
  },

  // 创建文件
  async createFile(projectName: string, filePath: string, content?: string): Promise<void> {
    await axios.post(`${API_BASE_URL}/create-file`, {
      project: projectName,
      path: filePath,
      content
    });
  },

  // 删除文件/文件夹
  async deleteItem(projectName: string, itemPath: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/item`, {
      params: { project: projectName, path: itemPath }
    });
  },

  // 重命名文件/文件夹
  async renameItem(projectName: string, oldPath: string, newPath: string): Promise<void> {
    await axios.post(`${API_BASE_URL}/rename`, {
      project: projectName,
      oldPath,
      newPath
    });
  },

  // 上传文件
  async uploadFiles(projectName: string, files: FileList, targetPath?: string): Promise<Array<{ name: string; path: string; size: number }>> {
    const formData = new FormData();
    formData.append('project', projectName);
    if (targetPath) {
      formData.append('path', targetPath);
    }
    
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    
    const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data.files;
  },

  // 创建项目
  async createProject(name: string): Promise<Project> {
    const response = await axios.post(`${API_BASE_URL}/projects`, { name });
    return response.data.project;
  },

  // 删除项目
  async deleteProject(name: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/projects/${name}`);
  }
};
