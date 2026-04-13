import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import path from 'path';
import fs from 'fs';
import chokidar from 'chokidar';
import multer from 'multer';
const pty = require('node-pty');

const app = express();
const PORT = 3001;
const WS_PORT = 3002;

// 项目根目录（axure 文件夹所在路径）
const PROJECT_ROOT = path.join(__dirname, '..');
const AXURE_DIR = path.join(PROJECT_ROOT, 'axure');
const PROJECTS_DIR = path.join(AXURE_DIR, 'projects');

app.use(cors());
app.use(express.json());

// 存储终端会话
const terminalSessions = new Map();

// 中文文件名编码修复
// 将 Latin-1 编码的字符串转换回 UTF-8
function fixFilenameEncoding(filename: string): string {
  try {
    // multer 使用 Latin-1 解析，需要转换回 UTF-8
    const buffer = Buffer.from(filename, 'latin1');
    return buffer.toString('utf8');
  } catch (error) {
    console.error('文件名编码修复失败:', error);
    return filename;
  }
}

// 配置 multer 用于文件上传
// 使用内存存储，然后手动保存到目标位置
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB 限制
});

// 确保 projects 目录存在
if (!fs.existsSync(PROJECTS_DIR)) {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
}

// 获取项目列表 API
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await getProjectsList();
    res.json({ success: true, projects });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get projects' });
  }
});

// 创建项目 API
app.post('/api/projects', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, error: '项目名称不能为空' });
    }

    const projectDir = path.join(PROJECTS_DIR, name);

    if (fs.existsSync(projectDir)) {
      return res.status(400).json({ success: false, error: '项目已存在' });
    }

    // 创建项目目录结构 - 仅保留 assets 文件夹
    fs.mkdirSync(projectDir, { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'assets'), { recursive: true });

    // 创建默认 index.html（不引用外部 CSS/JS）
    const defaultHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      padding: 20px;
      background: #f5f5f5;
    }
    
    #app {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    
    h1 {
      color: #333;
      margin-bottom: 20px;
    }
    
    p {
      color: #666;
    }
  </style>
</head>
<body>
  <div id="app">
    <h1>欢迎来到 ${name}</h1>
    <p>这是一个新创建的项目</p>
    <p>你可以在 <code>assets</code> 文件夹中添加图片、字体等资源文件</p>
  </div>
  <script>
    // 在这里添加你的 JavaScript 代码
    console.log('${name} 已加载');
  </script>
</body>
</html>`;

    fs.writeFileSync(path.join(projectDir, 'index.html'), defaultHtml, 'utf-8');

    console.log(`✅ 新项目已创建：${name}`);
    res.json({ success: true, project: { name, path: name } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create project' });
  }
});

// 存储每个 WebSocket 连接的文件监听器
const wsWatchers = new Map<WebSocket, chokidar.FSWatcher>();

// 删除项目 API
app.delete('/api/projects/:projectName', async (req, res) => {
  try {
    const { projectName } = req.params;
    const projectDir = path.join(PROJECTS_DIR, projectName);

    if (!fs.existsSync(projectDir)) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }

    // 临时关闭所有文件监听器（因为它们可能锁定了文件）
    const closedWatchers: Array<{ws: WebSocket, watcher: chokidar.FSWatcher}> = [];
    for (const [ws, watcher] of wsWatchers.entries()) {
      await watcher.close();
      closedWatchers.push({ ws, watcher });
      console.log(`🔍 已关闭 WebSocket 文件监听器`);
    }

    // 等待 watcher 完全释放文件句柄
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Windows 下尝试强制删除，如遇占用则重试
    let retries = 3;
    let deleted = false;
    while (retries > 0 && !deleted) {
      try {
        await fs.promises.rm(projectDir, { recursive: true, force: true, maxRetries: 3 });
        deleted = true;
      } catch (err: any) {
        if (err.code === 'EBUSY' || err.code === 'EPERM') {
          retries--;
          if (retries > 0) {
            console.log(`⚠️ 文件被占用，重试中... (${retries}/3)`);
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            throw new Error('文件被占用，请关闭占用该项目的程序后重试（如终端、资源管理器等）');
          }
        } else {
          throw err;
        }
      }
    }

    console.log(`🗑️ 项目已删除：${projectName}`);

    // 重新建立文件监听器
    for (const { ws, watcher } of closedWatchers) {
      // 重新监听（chokidar watcher 关闭后不能重用，需要重新创建）
      const newWatcher = chokidar.watch(PROJECTS_DIR, {
        ignored: /node_modules|[\/\\]\./,
        persistent: true,
        ignoreInitial: true
      });

      newWatcher.on('change', (filePath) => {
        // 获取相对于 PROJECTS_DIR 的路径（包含项目名）
        // 例如：C:/.../projects/project-1/assets/file.json -> project-1/assets/file.json
        const fullPath = path.relative(PROJECTS_DIR, filePath).replace(/\\/g, '/');
        ws.send(JSON.stringify({
          type: 'file-change',
          path: fullPath,
          timestamp: Date.now()
        }));
      });

      newWatcher.on('add', (filePath) => {
        const fullPath = path.relative(PROJECTS_DIR, filePath).replace(/\\/g, '/');
        ws.send(JSON.stringify({
          type: 'file-add',
          path: fullPath,
          timestamp: Date.now()
        }));
      });

      newWatcher.on('unlink', (filePath) => {
        const fullPath = path.relative(PROJECTS_DIR, filePath).replace(/\\/g, '/');
        ws.send(JSON.stringify({
          type: 'file-delete',
          path: fullPath,
          timestamp: Date.now()
        }));
      });

      wsWatchers.set(ws, newWatcher);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('删除项目失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete project'
    });
  }
});

// 获取指定项目的文件树 API
app.get('/api/files', async (req, res) => {
  try {
    const projectName = req.query.project as string || 'project-1';
    const projectDir = path.join(PROJECTS_DIR, projectName);
    
    if (!fs.existsSync(projectDir)) {
      return res.json({ success: true, files: [] });
    }
    
    const files = await getFilesRecursively(projectDir);
    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get files' });
  }
});

// 读取文件内容 API
app.get('/api/file', async (req, res) => {
  try {
    const projectName = req.query.project as string || 'project-1';
    const filePath = req.query.path as string;
    const fullPath = path.join(PROJECTS_DIR, projectName, filePath);

    if (!fullPath.startsWith(PROJECTS_DIR)) {
      return res.status(403).json({ success: false, error: 'Invalid path' });
    }
    const content = await fs.promises.readFile(fullPath, 'utf-8');
    res.json({ success: true, content });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to read file' });
  }
});

// 读取文件 Blob API（用于图片/视频等二进制文件）
app.get('/api/file/blob', async (req, res) => {
  try {
    const projectName = req.query.project as string || 'project-1';
    let filePath = req.query.path as string;

    // URL 解码：处理中文字符
    // 浏览器发送的 URL 会自动编码，如：胡图.png -> %E8%83%A1%E5%9B%BE.png
    try {
      filePath = decodeURIComponent(filePath);
    } catch (e) {
      console.log('路径解码失败，使用原始路径:', e);
    }

    console.log('📥 Blob API 请求:', {
      project: projectName,
      path: filePath,
      query: req.query
    });

    // 统一路径分隔符：将 / 转换为平台特定分隔符
    const normalizedPath = filePath.replace(/\//g, path.sep);
    const fullPath = path.join(PROJECTS_DIR, projectName, normalizedPath);

    console.log('📁 完整路径:', fullPath);

    if (!fullPath.startsWith(PROJECTS_DIR)) {
      return res.status(403).json({ success: false, error: 'Invalid path' });
    }

    const fileBuffer = await fs.promises.readFile(fullPath);

    console.log('✅ 文件读取成功:', {
      size: fileBuffer.length,
      path: filePath
    });

    // 设置 Content-Type
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
      '.bmp': 'image/bmp',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.webm': 'video/webm',
      '.ogg': 'video/ogg',
      '.mkv': 'video/x-matroska',
      '.flv': 'video/x-flv'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(fileBuffer);
  } catch (error) {
    console.error('❌ Blob API 错误:', error);
    res.status(500).json({ success: false, error: 'Failed to read file' });
  }
});

// 批量获取资源文件 API（用于导出功能）
app.post('/api/files/batch', async (req, res) => {
  try {
    const { project, paths } = req.body;
    const projectName = project || 'project-1';

    if (!paths || !Array.isArray(paths)) {
      return res.status(400).json({ success: false, error: 'paths 必须是数组' });
    }

    console.log('📥 批量获取资源文件:', { project: projectName, fileCount: paths.length });

    const results: Array<{
      path: string;
      content?: string;
      base64?: string;
      exists: boolean;
      error?: string;
    }> = [];

    for (const filePath of paths) {
      try {
        // URL 解码
        let decodedPath = filePath;
        try {
          decodedPath = decodeURIComponent(filePath);
        } catch (e) {
          // 使用原始路径
        }

        // 统一路径分隔符
        const normalizedPath = decodedPath.replace(/\//g, path.sep);
        const fullPath = path.join(PROJECTS_DIR, projectName, normalizedPath);

        if (!fullPath.startsWith(PROJECTS_DIR)) {
          results.push({ path: filePath, exists: false, error: 'Invalid path' });
          continue;
        }

        const fileBuffer = await fs.promises.readFile(fullPath);
        const ext = path.extname(filePath).toLowerCase();

        // 判断是否为文本文件
        const textExts = ['.html', '.htm', '.css', '.js', '.ts', '.json', '.xml', '.txt', '.md', '.svg'];
        const isTextFile = textExts.includes(ext);

        if (isTextFile) {
          results.push({
            path: filePath,
            content: fileBuffer.toString('utf-8'),
            exists: true
          });
        } else {
          // 二进制文件返回 base64
          results.push({
            path: filePath,
            base64: fileBuffer.toString('base64'),
            exists: true
          });
        }
      } catch (error: any) {
        console.error(`❌ 读取文件失败: ${filePath}`, error.message);
        results.push({ path: filePath, exists: false, error: error.message });
      }
    }

    console.log(`✅ 批量获取完成: 成功 ${results.filter(r => r.exists).length}/${results.length}`);
    res.json({ success: true, files: results });
  } catch (error: any) {
    console.error('❌ 批量获取资源文件失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 保存文件 API
app.post('/api/file', async (req, res) => {
  try {
    const projectName = req.body.project || 'project-1';
    const { path: filePath, content } = req.body;
    const fullPath = path.join(PROJECTS_DIR, projectName, filePath);
    
    if (!fullPath.startsWith(PROJECTS_DIR)) {
      return res.status(403).json({ success: false, error: 'Invalid path' });
    }
    
    // 确保目录存在
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    await fs.promises.writeFile(fullPath, content, 'utf-8');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to save file' });
  }
});

// 创建文件夹 API
app.post('/api/folder', async (req, res) => {
  try {
    const projectName = req.body.project || 'project-1';
    const { path: folderPath } = req.body;
    const fullPath = path.join(PROJECTS_DIR, projectName, folderPath);
    
    if (!fullPath.startsWith(PROJECTS_DIR)) {
      return res.status(403).json({ success: false, error: 'Invalid path' });
    }
    
    await fs.promises.mkdir(fullPath, { recursive: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create folder' });
  }
});

// 创建文件 API
app.post('/api/create-file', async (req, res) => {
  try {
    const projectName = req.body.project || 'project-1';
    const { path: filePath, content = '' } = req.body;
    const fullPath = path.join(PROJECTS_DIR, projectName, filePath);
    
    if (!fullPath.startsWith(PROJECTS_DIR)) {
      return res.status(403).json({ success: false, error: 'Invalid path' });
    }
    
    // 确保目录存在
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    await fs.promises.writeFile(fullPath, content || '', 'utf-8');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create file' });
  }
});

// 删除文件/文件夹 API
app.delete('/api/item', async (req, res) => {
  try {
    const projectName = req.query.project as string || 'project-1';
    const itemPath = req.query.path as string;
    const fullPath = path.join(PROJECTS_DIR, projectName, itemPath);
    
    if (!fullPath.startsWith(PROJECTS_DIR)) {
      return res.status(403).json({ success: false, error: 'Invalid path' });
    }
    
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      await fs.promises.rm(fullPath, { recursive: true });
    } else {
      await fs.promises.unlink(fullPath);
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete item' });
  }
});

// 重命名文件/文件夹 API
app.post('/api/rename', async (req, res) => {
  try {
    const projectName = req.body.project || 'project-1';
    const { oldPath, newPath } = req.body;
    
    // 统一使用正斜杠 / 作为路径分隔符
    const normalizedOldPath = oldPath.replace(/\\/g, '/');
    const normalizedNewPath = newPath.replace(/\\/g, '/');
    
    // 使用 path.normalize 处理路径（将 / 转换为平台特定分隔符）
    const oldFullPath = path.join(PROJECTS_DIR, projectName, path.normalize(normalizedOldPath));
    const newFullPath = path.join(PROJECTS_DIR, projectName, path.normalize(normalizedNewPath));

    if (!oldFullPath.startsWith(PROJECTS_DIR) || !newFullPath.startsWith(PROJECTS_DIR)) {
      return res.status(403).json({ success: false, error: 'Invalid path' });
    }

    await fs.promises.rename(oldFullPath, newFullPath);
    res.json({ success: true });
  } catch (error) {
    console.error('重命名失败:', error);
    res.status(500).json({ success: false, error: 'Failed to rename item' });
  }
});

// 上传文件 API
app.post('/api/upload', upload.array('files', 10), async (req, res) => {
  try {
    const projectName = req.body.project || 'project-1';
    const targetPath = req.body.path || '';

    console.log('📥 上传请求:', {
      projectName,
      targetPath,
      fileCount: req.files?.length || 0
    });

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ success: false, error: '没有上传文件' });
    }

    const projectDir = path.join(PROJECTS_DIR, projectName);
    const targetDir = path.join(projectDir, targetPath);

    if (!fs.existsSync(targetDir)) {
      console.log('📁 创建目录:', targetDir);
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const uploadedFiles: Array<{ name: string; path: string; size: number }> = [];
    const failedFiles: Array<{ name: string; error: string }> = [];

    for (const file of req.files) {
      try {
        // 修复中文文件名编码问题（Latin-1 → UTF-8）
        const originalName = fixFilenameEncoding(file.originalname);
        console.log('📁 原始文件名:', originalName, `(${file.size} bytes)`);

        // 使用原始文件名，改进中文和特殊字符支持
        // 只替换不允许的字符：/ \ : * ? " < > | 和控制字符
        let safeName = originalName
          .replace(/[\/\\:*?"<>|\x00-\x1f\x7f]/g, '_')  // 替换非法字符
          .replace(/\s+/g, ' ')  // 规范化空白字符
          .trim();

        // 如果文件名为空，使用默认名称
        if (!safeName || safeName === '.') {
          safeName = `unnamed_${Date.now()}`;
          console.log('⚠️ 文件名为空，使用默认名称:', safeName);
        }

        // 如果文件已存在，添加序号避免覆盖
        let finalFilename = safeName;
        let counter = 1;
        while (fs.existsSync(path.join(targetDir, finalFilename))) {
          const ext = path.extname(safeName);
          const name = path.basename(safeName, ext);
          finalFilename = `${name}_${counter}${ext}`;
          counter++;
        }

        if (finalFilename !== safeName) {
          console.log('⚠️ 文件重名，重命名为:', finalFilename);
        }

        const finalDestPath = path.join(targetDir, finalFilename);
        await fs.promises.writeFile(finalDestPath, file.buffer);

        uploadedFiles.push({
          name: finalFilename,
          path: targetPath ? `${targetPath}/${finalFilename}` : finalFilename,
          size: file.size
        });

        console.log('✅ 文件上传成功:', finalFilename);
      } catch (fileError: any) {
        console.error('❌ 单个文件上传失败:', file.originalname, fileError.message);
        failedFiles.push({
          name: file.originalname,
          error: fileError.message
        });
      }
    }

    console.log(`📤 上传完成：成功 ${uploadedFiles.length} 个，失败 ${failedFiles.length} 个`);

    const response = {
      success: true,
      files: uploadedFiles,
      failed: failedFiles,
      message: `成功上传 ${uploadedFiles.length} 个文件${failedFiles.length > 0 ? `，${failedFiles.length} 个失败` : ''}`
    };

    res.json(response);
  } catch (error: any) {
    console.error('❌ 上传失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload files'
    });
  }
});

// 获取项目列表
async function getProjectsList(): Promise<Array<{ name: string; path: string }>> {
  const projects: Array<{ name: string; path: string }> = [];
  
  try {
    const entries = await fs.promises.readdir(PROJECTS_DIR, { withFileTypes: true });
    
    for (const entry of entries) {
      // 排除隐藏文件夹、uploads 临时文件夹和 node_modules
      if (entry.isDirectory() && 
          !entry.name.startsWith('.') && 
          entry.name !== 'uploads' && 
          entry.name !== 'node_modules') {
        projects.push({
          name: entry.name,
          path: entry.name
        });
      }
    }
  } catch (error) {
    console.error('Error reading projects:', error);
  }
  
  return projects;
}

// 递归获取文件列表
async function getFilesRecursively(dir: string, baseDir = dir): Promise<Array<{ path: string; name: string; type: 'file' | 'folder'; children?: any[] }>> {
  const result: any[] = [];

  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const fullPath = path.join(dir, entry.name);
      // 统一使用正斜杠 / 作为路径分隔符（兼容 Windows 和 Unix）
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        const children = await getFilesRecursively(fullPath, baseDir);
        result.push({
          path: relativePath,
          name: entry.name,
          type: 'folder' as const,
          children
        });
      } else {
        result.push({
          path: relativePath,
          name: entry.name,
          type: 'file' as const
        });
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }

  return result;
}

// 初始化项目结构
function initializeProjectStructure() {
  const projectDir = path.join(PROJECTS_DIR, 'project-1');

  if (!fs.existsSync(projectDir)) {
    // 创建项目目录 - 仅保留 assets 文件夹
    fs.mkdirSync(projectDir, { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'assets'), { recursive: true });

    // 创建默认 index.html（内联样式和脚本）
    const defaultHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>我的项目</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      padding: 20px;
      background: #f5f5f5;
    }
    
    #app {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    
    h1 {
      color: #333;
      margin-bottom: 20px;
    }
    
    p {
      color: #666;
    }
  </style>
</head>
<body>
  <div id="app">
    <h1>欢迎来到我的项目</h1>
    <p>这是一个由 AI Product Manager 创建的项目</p>
    <p>你可以在 <code>assets</code> 文件夹中添加图片、字体等资源文件</p>
  </div>
  <script>
    // 应用入口
    console.log('应用已加载');
    
    // 在这里添加你的交互逻辑
    const app = document.getElementById('app');
    if (app) {
      console.log('App 元素:', app);
    }
  </script>
</body>
</html>`;

    fs.writeFileSync(path.join(projectDir, 'index.html'), defaultHtml, 'utf-8');

    console.log('✅ 项目结构已初始化：project-1');
  }
}

// 启动 HTTP 服务
const server = app.listen(PORT, () => {
  console.log(`📡 HTTP Server running on http://localhost:${PORT}`);
  initializeProjectStructure();
});

// 启动 WebSocket 服务用于热更新和终端
const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws, req) => {
  console.log('🔌 Client connected to WebSocket');

  const url = new URL(req.url || '', `ws://localhost:${WS_PORT}`);
  const sessionId = url.searchParams.get('session') || `default-${Date.now()}`;

  // 处理终端会话
  if (url.searchParams.has('terminal')) {
    const cwd = url.searchParams.get('cwd') || PROJECTS_DIR;

    try {
      // 使用 node-pty 创建真正的伪终端 - 使用 PowerShell
      const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
      const args = process.platform === 'win32'
        ? ['-NoExit', '-NoProfile', '-Command', `Set-Location "${cwd.replace(/"/g, '`"')}"`]
        : [];

      console.log(`📌 Spawning terminal: ${shell} ${args.join(' ')} (cwd: ${cwd})`);

      const ptyProcess = pty.spawn(shell, args, {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd,
        env: { ...process.env }
      });

      terminalSessions.set(sessionId, ptyProcess);
      console.log(`✅ Terminal session ${sessionId} created, PID: ${ptyProcess.pid}`);

      // 终端输出 → 前端
      ptyProcess.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'terminal-data',
            session: sessionId,
            data
          }));
        }
      });

      ptyProcess.onExit(({ exitCode, signal }: { exitCode: number | null, signal: number | null }) => {
        console.log(`🚪 Terminal exited: ${exitCode}, signal: ${signal}`);
        terminalSessions.delete(sessionId);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'terminal-exit',
            session: sessionId,
            exitCode,
            signal
          }));
        }
      });

      // 前端输入 → 终端
      ws.on('message', (message) => {
        try {
          const msg = JSON.parse(message.toString());

          if (msg.type === 'terminal-input' && msg.session === sessionId) {
            ptyProcess.write(msg.data);
          }

          if (msg.type === 'terminal-resize' && msg.session === sessionId) {
            ptyProcess.resize(msg.cols, msg.rows);
          }
        } catch (error) {
          console.error('Error handling terminal message:', error);
        }
      });

      ws.on('close', () => {
        console.log(`🔌 Terminal session ${sessionId} closed`);
        try {
          ptyProcess.kill();
        } catch (error) {
          console.error('Error killing pty process:', error);
        }
        terminalSessions.delete(sessionId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for session ${sessionId}:`, error);
      });

      // 发送欢迎消息
      ws.send(JSON.stringify({
        type: 'terminal-ready',
        session: sessionId
      }));

      return;
    } catch (error) {
      console.error('❌ Failed to spawn terminal:', error);
      ws.send(JSON.stringify({
        type: 'terminal-error',
        session: sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
      return;
    }
  }

  // 文件热更新 WebSocket
  // 监听 projects 文件夹变化
  const watcher = chokidar.watch(PROJECTS_DIR, {
    ignored: /node_modules|[\/\\]\./,
    persistent: true,
    ignoreInitial: true
  });

  // 存储监听器到 Map 中
  wsWatchers.set(ws, watcher);

  watcher.on('change', (filePath) => {
    const relativePath = path.relative(PROJECTS_DIR, filePath);
    console.log(`📝 File changed: ${relativePath}`);
    ws.send(JSON.stringify({
      type: 'file-change',
      path: relativePath,
      timestamp: Date.now()
    }));
  });

  watcher.on('add', (filePath) => {
    const relativePath = path.relative(PROJECTS_DIR, filePath);
    console.log(`📄 File added: ${relativePath}`);
    ws.send(JSON.stringify({
      type: 'file-add',
      path: relativePath,
      timestamp: Date.now()
    }));
  });

  watcher.on('unlink', (filePath) => {
    const relativePath = path.relative(PROJECTS_DIR, filePath);
    console.log(`🗑️ File deleted: ${relativePath}`);
    ws.send(JSON.stringify({
      type: 'file-delete',
      path: relativePath,
      timestamp: Date.now()
    }));
  });

  ws.on('close', () => {
    console.log('🔌 Client disconnected');
    const watcher = wsWatchers.get(ws);
    if (watcher) {
      watcher.close();
      wsWatchers.delete(ws);
    }
  });
});

console.log(`🔌 WebSocket Server running on ws://localhost:${WS_PORT}`);
