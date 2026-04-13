import { useState, useEffect, useRef } from 'react';
import { api, type FileItem } from '../api/client';

interface FileTreeProps {
  projectName: string;
  onSelectFile?: (path: string) => void;
  selectedPath?: string;
  onRefresh?: () => void;
}

interface FileTreeNodeProps {
  file: FileItem;
  level: number;
  projectName: string;
  onSelectFile?: (path: string) => void;
  selectedPath?: string;
  onRefresh: () => void;
}

/**
 * 将文件树中的路径转换为相对于项目目录的路径
 * 文件树中的 file.path 格式：project-1/assets/image.png 或 project-1/index.html
 * 后端 API 期望的路径格式：assets/image.png 或 index.html（相对于项目目录）
 */
function getRelativePath(filePath: string, projectName: string): string {
  // 如果路径以项目名开头，去掉项目名前缀
  if (filePath.startsWith(projectName + '/')) {
    return filePath.substring(projectName.length + 1);
  }
  if (filePath === projectName) {
    return '';
  }
  return filePath;
}

// 文件树节点组件
function FileTreeNode({ file, level, projectName, onSelectFile, selectedPath, onRefresh }: FileTreeNodeProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [uploading, setUploading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(level < 2); // 默认展开前两级
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (file.type === 'folder') {
      setIsExpanded(!isExpanded);
    } else {
      onSelectFile?.(file.path);
    }
  };

  const isSelected = selectedPath === file.path;

  // 右键菜单
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const menuWidth = 160;
    const menuHeight = 200;
    const x = e.clientX + menuWidth > window.innerWidth 
      ? e.clientX - menuWidth 
      : e.clientX;
    const y = e.clientY + menuHeight > window.innerHeight 
      ? e.clientY - menuHeight 
      : e.clientY;
    
    setShowContextMenu(true);
    setContextMenuPos({ x, y });
  };

  // 关闭菜单
  useEffect(() => {
    const closeMenu = () => setShowContextMenu(false);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  // 创建子文件夹
  const handleCreateFolder = async () => {
    const name = prompt('请输入文件夹名称:');
    if (!name) return;

    // 转换为相对路径（去掉项目名前缀）
    const relativePath = getRelativePath(file.path, projectName);
    const basePath = file.type === 'folder' ? relativePath : relativePath.substring(0, relativePath.lastIndexOf('/'));
    const newPath = basePath ? `${basePath}/${name}` : name;

    await api.createFolder(projectName, newPath);
    onRefresh();
  };

  // 创建文件
  const handleCreateFile = async () => {
    const name = prompt('请输入文件名称 (如：page.html):');
    if (!name) return;

    // 转换为相对路径（去掉项目名前缀）
    const relativePath = getRelativePath(file.path, projectName);
    const basePath = file.type === 'folder' ? relativePath : relativePath.substring(0, relativePath.lastIndexOf('/'));
    const newPath = basePath ? `${basePath}/${name}` : name;

    let defaultContent = '';
    if (name.endsWith('.html')) {
      defaultContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
</head>
<body>
  <h1>${name}</h1>
</body>
</html>`;
    } else if (name.endsWith('.css')) {
      defaultContent = `/* ${name} */\n`;
    } else if (name.endsWith('.js')) {
      defaultContent = `// ${name}\n`;
    }

    await api.createFile(projectName, newPath, defaultContent);
    onRefresh();
  };

  // 上传文件
  const handleUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setUploading(true);
    try {
      // 转换为相对路径（去掉项目名前缀）
      const relativePath = getRelativePath(file.path, projectName);
      const targetPath = file.type === 'folder' ? relativePath : relativePath.substring(0, relativePath.lastIndexOf('/'));
      await api.uploadFiles(projectName, e.target.files, targetPath);
      onRefresh();
    } catch (error) {
      console.error('上传失败:', error);
      alert('上传失败，请重试');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 删除
  const handleDelete = async () => {
    if (!confirm(`确定要删除 "${file.name}" 吗？此操作不可撤销！`)) return;

    // 转换为相对路径（去掉项目名前缀）
    const relativePath = getRelativePath(file.path, projectName);
    await api.deleteItem(projectName, relativePath);
    onRefresh();
  };

  // 重命名
  const handleRename = async () => {
    setShowContextMenu(false);
    const newName = prompt('请输入新名称:', file.name);
    if (!newName || newName === file.name) return;

    // 转换为相对路径（去掉项目名前缀）
    const relativePath = getRelativePath(file.path, projectName);
    
    // 计算新路径：保留父目录，只修改文件名
    const lastSlashIndex = relativePath.lastIndexOf('/');
    const newPath = lastSlashIndex === -1
      ? newName  // 文件在根目录，直接重命名
      : `${relativePath.substring(0, lastSlashIndex)}/${newName}`;  // 保留父路径

    await api.renameItem(projectName, relativePath, newPath);
    onRefresh();
  };

  return (
    <div className="file-tree-node">
      <input
        type="file"
        ref={fileInputRef}
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      
      <div
        className={`file-tree-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <span className="file-tree-icon">
          {file.type === 'folder' ? (isExpanded ? '📂' : '📁') : '📄'}
        </span>
        <span className="file-tree-name">{file.name}</span>
        {uploading && <span className="uploading-indicator">⏳</span>}
      </div>
      
      {/* 右键菜单 */}
      {showContextMenu && (
        <div 
          className="context-menu"
          style={{ 
            position: 'fixed',
            left: contextMenuPos.x,
            top: contextMenuPos.y,
            zIndex: 1000
          }}
        >
          {file.type === 'folder' && (
            <>
              <button onClick={handleCreateFolder}>📁 新建文件夹</button>
              <button onClick={handleCreateFile}>📄 新建文件</button>
              <button onClick={handleUpload}>📤 上传文件</button>
              <div className="context-menu-divider"></div>
            </>
          )}
          <button onClick={handleRename}>✏️ 重命名</button>
          <button onClick={handleDelete} className="danger">🗑️ 删除</button>
        </div>
      )}
      
      {file.type === 'folder' && isExpanded && file.children && (
        <div className="file-tree-children">
          {file.children.map((child) => (
            <FileTreeNode
              key={child.path}
              file={child}
              level={level + 1}
              projectName={projectName}
              onSelectFile={onSelectFile}
              selectedPath={selectedPath}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 文件树主组件
export function FileTree({ projectName, onSelectFile, selectedPath }: FileTreeProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['']));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const data = await api.getFiles(projectName);
      setFiles(data);
      setError(null);
    } catch (err) {
      setError('加载文件列表失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [projectName]);

  // 根目录上传
  const handleUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setUploading(true);
    try {
      // 根目录上传，targetPath 为空字符串
      await api.uploadFiles(projectName, e.target.files, '');
      loadFiles();
    } catch (error) {
      console.error('上传失败:', error);
      alert('上传失败，请重试');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <span className="file-tree-title">📁 文件管理系统</span>
        <div className="file-tree-actions">
          <button className="file-tree-refresh" onClick={loadFiles} title="刷新">
            🔄
          </button>
          <input
            type="file"
            ref={fileInputRef}
            multiple
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button 
            className="file-tree-add" 
            onClick={handleUpload} 
            title="上传文件"
            disabled={uploading}
          >
            {uploading ? '⏳' : '📤'}
          </button>
        </div>
      </div>
      <div className="file-tree-content">
        {loading ? (
          <div className="file-tree-loading">加载中...</div>
        ) : error ? (
          <div className="file-tree-error">{error}</div>
        ) : files.length === 0 ? (
          <div className="file-tree-empty">
            <p>暂无文件</p>
            <p className="hint">右键点击文件夹可创建子文件/文件夹或上传文件</p>
          </div>
        ) : (
          files.map((file) => (
            <FileTreeNode
              key={file.path}
              file={file}
              level={0}
              projectName={projectName}
              onSelectFile={onSelectFile}
              selectedPath={selectedPath}
              onRefresh={loadFiles}
            />
          ))
        )}
      </div>
    </div>
  );
}
