import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import chokidar from 'chokidar';
import multer from 'multer';
import { authenticate } from '../middleware/auth.js';
import { getUserProjectsDir, ensureUserProjectsDir, resolveUserFilePath } from '../utils/userProjects.js';
import { prisma } from '../db/prisma.js';
import { verifyAccessToken, extractTokenFromHeader } from '../utils/jwt.js';

const router = Router();

// 中文文件名编码修复
function fixFilenameEncoding(filename: string): string {
  try {
    const buffer = Buffer.from(filename, 'latin1');
    return buffer.toString('utf8');
  } catch (error) {
    console.error('文件名编码修复失败:', error);
    return filename;
  }
}

// 配置 multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// 递归获取文件列表
async function getFilesRecursively(dir: string, baseDir: string): Promise<any[]> {
  const result: any[] = [];

  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const fullPath = path.join(dir, entry.name);
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

// ============ 不需要认证的路由 (放在最前面) ============

// 读取文件 Blob - 不需要认证 (用于 HTML 中的图片/资源引用)
// 支持用户目录和旧项目目录
router.get('/file/blob', async (req: Request, res: Response) => {
  try {
    const projectName = req.query.project as string;
    let filePath = req.query.path as string;

    console.log('[blob API] 请求参数:', { project: projectName, path: filePath, token: req.query.token ? 'present' : 'none' });

    if (!projectName || !filePath) {
      return res.status(400).json({ success: false, error: '缺少参数' });
    }

    try {
      filePath = decodeURIComponent(filePath);
    } catch (e) {
      // 使用原始路径
    }

    let fullPath: string | null = null;

    // 1. 尝试从 Authorization header 或 query token 获取用户 ID
    let userId: string | null = null;
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token as string | undefined;
    
    if (authHeader) {
      const token = extractTokenFromHeader(authHeader);
      if (token) {
        const payload = verifyAccessToken(token);
        if (payload) {
          userId = payload.userId;
          console.log('[blob API] 从 header 获取用户 ID:', userId);
        }
      }
    } else if (queryToken) {
      const payload = verifyAccessToken(queryToken);
      if (payload) {
        userId = payload.userId;
        console.log('[blob API] 从 query 获取用户 ID:', userId);
      }
    }

    // 2. 如果有用户 ID，尝试用户目录
    if (userId) {
      try {
        fullPath = resolveUserFilePath(userId, path.join(projectName, filePath));
        console.log('[blob API] 用户目录路径:', fullPath);
      } catch (e: any) {
        console.log('[blob API] 用户目录路径解析失败:', e.message);
      }
    }

    // 3. 如果用户目录不存在，尝试旧的项目目录 (向后兼容)
    if (!fullPath || !fs.existsSync(fullPath)) {
      // 使用与 userProjects.ts 相同的方式获取项目根目录
      // files.ts 在 server/src/routes 目录下
      const { fileURLToPath } = await import('url');
      const __filename2 = fileURLToPath(import.meta.url);
      const __dirname2 = path.dirname(__filename2);
      // __dirname2 -> server/src/routes
      // .. -> server/src
      // ../.. -> server
      // ../../.. -> 项目根目录
      const PROJECT_ROOT = path.join(__dirname2, '..', '..', '..');
      fullPath = path.join(PROJECT_ROOT, 'axure', 'projects', projectName, filePath);
      console.log('[blob API] 旧项目目录路径:', fullPath);
    }

    if (!fs.existsSync(fullPath)) {
      console.log('[blob API] 文件不存在:', fullPath);
      return res.status(404).json({ success: false, error: `文件不存在：${projectName}/${filePath}` });
    }

    console.log('[blob API] 文件存在，读取:', fullPath);
    const fileBuffer = await fs.promises.readFile(fullPath);

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
      '.ico': 'image/x-icon', '.bmp': 'image/bmp', '.mp4': 'video/mp4',
      '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.webm': 'video/webm'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(fileBuffer);
  } catch (error: any) {
    console.error('读取文件 Blob 失败:', error);
    res.status(500).json({ success: false, error: error.message || '读取文件失败' });
  }
});

// ============ 认证中间件 ============

// 所有文件相关 API 都需要认证
router.use(authenticate);

// ============ 项目相关 ============

// 获取项目列表（仅当前用户的项目）
router.get('/projects', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });

    res.json({ 
      success: true, 
      projects: projects.map((p: any) => ({ name: p.name, path: p.name })) 
    });
  } catch (error) {
    console.error('获取项目列表失败:', error);
    res.status(500).json({ success: false, error: '获取项目列表失败' });
  }
});

// 创建项目
router.post('/projects', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, error: '项目名称不能为空' });
    }

    // 检查项目名称唯一性
    const existing = await prisma.project.findFirst({
      where: { userId, name }
    });

    if (existing) {
      return res.status(400).json({ success: false, error: '项目已存在' });
    }

    // 创建数据库记录
    const project = await prisma.project.create({
      data: { userId, name }
    });

    // 创建项目目录
    const projectDir = path.join(getUserProjectsDir(userId), name);
    fs.mkdirSync(path.join(projectDir, 'assets'), { recursive: true });

    // 创建默认 index.html
    const defaultHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; padding: 20px; background: #f5f5f5; }
    #app { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; margin-bottom: 20px; }
    p { color: #666; }
  </style>
</head>
<body>
  <div id="app">
    <h1>欢迎来到 ${name}</h1>
    <p>这是一个新创建的项目</p>
  </div>
</body>
</html>`;

    fs.writeFileSync(path.join(projectDir, 'index.html'), defaultHtml, 'utf-8');

    res.json({ success: true, project: { name: project.name, path: project.name } });
  } catch (error) {
    console.error('创建项目失败:', error);
    res.status(500).json({ success: false, error: '创建项目失败' });
  }
});

// 删除项目
router.delete('/projects/:name', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name } = req.params;

    const project = await prisma.project.findFirst({
      where: { userId, name }
    });

    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }

    const projectDir = path.join(getUserProjectsDir(userId), name);

    if (!fs.existsSync(projectDir)) {
      // 数据库记录存在但目录不存在，只删除记录
      await prisma.project.delete({ where: { id: project.id } });
      return res.json({ success: true });
    }

    // 删除目录
    await fs.promises.rm(projectDir, { recursive: true, force: true });

    // 删除数据库记录
    await prisma.project.delete({ where: { id: project.id } });

    res.json({ success: true });
  } catch (error) {
    console.error('删除项目失败:', error);
    res.status(500).json({ success: false, error: '删除项目失败' });
  }
});

// ============ 文件操作 ============

// 获取文件树
router.get('/files', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectName = req.query.project as string;

    if (!projectName) {
      return res.status(400).json({ success: false, error: '缺少项目名称' });
    }

    const projectDir = path.join(getUserProjectsDir(userId), projectName);

    if (!fs.existsSync(projectDir)) {
      return res.json({ success: true, files: [] });
    }

    const files = await getFilesRecursively(projectDir, projectDir);
    res.json({ success: true, files });
  } catch (error) {
    console.error('获取文件列表失败:', error);
    res.status(500).json({ success: false, error: '获取文件列表失败' });
  }
});

// 读取文件内容
router.get('/file', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectName = req.query.project as string;
    const filePath = req.query.path as string;

    if (!projectName || !filePath) {
      return res.status(400).json({ success: false, error: '缺少参数' });
    }

    const fullPath = resolveUserFilePath(userId, path.join(projectName, filePath));

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, error: '文件不存在' });
    }

    const content = await fs.promises.readFile(fullPath, 'utf-8');
    res.json({ success: true, content });
  } catch (error: any) {
    console.error('读取文件失败:', error);
    res.status(500).json({ success: false, error: error.message || '读取文件失败' });
  }
});

// 保存文件
router.post('/file', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectName = req.body.project;
    const { path: filePath, content } = req.body;

    if (!projectName || !filePath) {
      return res.status(400).json({ success: false, error: '缺少参数' });
    }

    const fullPath = resolveUserFilePath(userId, path.join(projectName, filePath));

    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await fs.promises.writeFile(fullPath, content, 'utf-8');
    res.json({ success: true });
  } catch (error: any) {
    console.error('保存文件失败:', error);
    res.status(500).json({ success: false, error: error.message || '保存文件失败' });
  }
});

// 创建文件夹
router.post('/folder', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectName = req.body.project;
    const { path: folderPath } = req.body;

    if (!projectName || !folderPath) {
      return res.status(400).json({ success: false, error: '缺少参数' });
    }

    const fullPath = resolveUserFilePath(userId, path.join(projectName, folderPath));
    await fs.promises.mkdir(fullPath, { recursive: true });
    res.json({ success: true });
  } catch (error: any) {
    console.error('创建文件夹失败:', error);
    res.status(500).json({ success: false, error: error.message || '创建文件夹失败' });
  }
});

// 创建文件
router.post('/create-file', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectName = req.body.project;
    const { path: filePath, content = '' } = req.body;

    if (!projectName || !filePath) {
      return res.status(400).json({ success: false, error: '缺少参数' });
    }

    const fullPath = resolveUserFilePath(userId, path.join(projectName, filePath));

    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await fs.promises.writeFile(fullPath, content || '', 'utf-8');
    res.json({ success: true });
  } catch (error: any) {
    console.error('创建文件失败:', error);
    res.status(500).json({ success: false, error: error.message || '创建文件失败' });
  }
});

// 删除文件/文件夹
router.delete('/item', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectName = req.query.project as string;
    const itemPath = req.query.path as string;

    if (!projectName || !itemPath) {
      return res.status(400).json({ success: false, error: '缺少参数' });
    }

    const fullPath = resolveUserFilePath(userId, path.join(projectName, itemPath));

    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      await fs.promises.rm(fullPath, { recursive: true });
    } else {
      await fs.promises.unlink(fullPath);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('删除项目失败:', error);
    res.status(500).json({ success: false, error: error.message || '删除失败' });
  }
});

// 重命名
router.post('/rename', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectName = req.body.project;
    const { oldPath, newPath } = req.body;

    if (!projectName || !oldPath || !newPath) {
      return res.status(400).json({ success: false, error: '缺少参数' });
    }

    const oldFullPath = resolveUserFilePath(userId, path.join(projectName, oldPath));
    const newFullPath = resolveUserFilePath(userId, path.join(projectName, newPath));

    await fs.promises.rename(oldFullPath, newFullPath);
    res.json({ success: true });
  } catch (error: any) {
    console.error('重命名失败:', error);
    res.status(500).json({ success: false, error: error.message || '重命名失败' });
  }
});

// 上传文件
router.post('/upload', upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectName = req.body.project;
    const targetPath = req.body.path || '';

    if (!projectName) {
      return res.status(400).json({ success: false, error: '缺少项目名称' });
    }

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ success: false, error: '没有上传文件' });
    }

    const projectDir = path.join(getUserProjectsDir(userId), projectName);
    const targetDir = path.join(projectDir, targetPath);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const uploadedFiles: any[] = [];

    for (const file of req.files) {
      const originalName = fixFilenameEncoding((file as any).originalname);
      let safeName = originalName.replace(/[\/\\:*?"<>|\x00-\x1f\x7f]/g, '_').trim();
      
      if (!safeName || safeName === '.') {
        safeName = `unnamed_${Date.now()}`;
      }

      let finalFilename = safeName;
      let counter = 1;
      while (fs.existsSync(path.join(targetDir, finalFilename))) {
        const ext = path.extname(safeName);
        const name = path.basename(safeName, ext);
        finalFilename = `${name}_${counter}${ext}`;
        counter++;
      }

      const destPath = path.join(targetDir, finalFilename);
      await fs.promises.writeFile(destPath, (file as any).buffer);

      uploadedFiles.push({
        name: finalFilename,
        path: targetPath ? `${targetPath}/${finalFilename}` : finalFilename,
        size: (file as any).size
      });
    }

    res.json({ success: true, files: uploadedFiles });
  } catch (error: any) {
    console.error('上传失败:', error);
    res.status(500).json({ success: false, error: error.message || '上传失败' });
  }
});

// 批量获取资源文件
router.post('/files/batch', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { project, paths } = req.body;

    if (!project || !paths || !Array.isArray(paths)) {
      return res.status(400).json({ success: false, error: '参数错误' });
    }

    const results: any[] = [];

    for (const filePath of paths) {
      try {
        let decodedPath = filePath;
        try {
          decodedPath = decodeURIComponent(filePath);
        } catch (e) {}

        const fullPath = resolveUserFilePath(userId, path.join(project, decodedPath));
        const fileBuffer = await fs.promises.readFile(fullPath);
        const ext = path.extname(filePath).toLowerCase();

        const textExts = ['.html', '.htm', '.css', '.js', '.ts', '.json', '.xml', '.txt', '.md', '.svg'];
        const isTextFile = textExts.includes(ext);

        if (isTextFile) {
          results.push({ path: filePath, content: fileBuffer.toString('utf-8'), exists: true });
        } else {
          results.push({ path: filePath, base64: fileBuffer.toString('base64'), exists: true });
        }
      } catch (error: any) {
        results.push({ path: filePath, exists: false, error: error.message });
      }
    }

    res.json({ success: true, files: results });
  } catch (error: any) {
    console.error('批量获取失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
