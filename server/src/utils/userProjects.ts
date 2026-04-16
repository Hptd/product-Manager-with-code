import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// 获取当前文件所在目录（server/src/utils）
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// PROJECT_ROOT 是项目根目录
// 在 Windows 上 path.join 往上跳目录有问题，使用字符串替换
// __dirname 格式：E:\productManager\server\src\utils 或 E:\productManager\server\dist\src\utils
// 我们需要：E:\productManager
const PROJECT_ROOT = __dirname.replace(/\\?(server\\src\\utils|server\\dist\\src\\utils)$/, '').replace(/\/?(server\/src\/utils|server\/dist\/src\/utils)$/, '');

// 获取用户项目根目录
export function getUserProjectsDir(userId: string): string {
  return path.join(PROJECT_ROOT, 'axure', 'users', userId, 'projects');
}

// 确保用户项目目录存在
export function ensureUserProjectsDir(userId: string): void {
  const userDir = getUserProjectsDir(userId);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
}

// 解析文件路径（防止路径穿越攻击）
export function resolveUserFilePath(userId: string, filePath: string): string {
  const projectsDir = getUserProjectsDir(userId);
  const fullPath = path.join(projectsDir, path.normalize(filePath));
  
  // 安全检查：确保路径在用户目录内
  if (!fullPath.startsWith(projectsDir)) {
    throw new Error('非法路径');
  }
  
  return fullPath;
}

// 迁移旧项目（从 axure/projects 到第一个用户的目录）
export async function migrateOldProjects(): Promise<boolean> {
  const oldProjectsDir = path.join(PROJECT_ROOT, 'axure', 'projects');
  
  if (!fs.existsSync(oldProjectsDir)) {
    return false; // 没有旧项目需要迁移
  }
  
  const entries = fs.readdirSync(oldProjectsDir, { withFileTypes: true });
  const hasProjects = entries.some(e => e.isDirectory() && !e.name.startsWith('.'));
  
  if (!hasProjects) {
    return false;
  }
  
  console.log('📦 检测到旧项目，需要迁移...');
  console.log('⚠️  请在创建第一个用户后手动执行迁移，或访问 /api/admin/migrate-projects');
  
  return true;
}
