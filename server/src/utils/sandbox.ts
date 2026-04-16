import Docker from 'dockerode';
import fs from 'fs';
import path from 'path';

// Docker 客户端单例
let docker: Docker | null = null;

function getDocker(): Docker {
  if (!docker) {
    docker = new Docker();
  }
  return docker;
}

// 沙箱会话接口
export interface SandboxSession {
  container: Docker.Container;
  execStream: NodeJS.ReadWriteStream;
  userId: string;
  project: string;
  sessionId: string;
  createdAt: Date;
  lastActiveAt: Date;
  volumeName?: string; // 用户持久化卷名称
}

// 存储活跃的沙箱会话
const sandboxSessions = new Map<string, SandboxSession>();

// 用户持久化卷缓存 (userId -> volumeName)
const userVolumes = new Map<string, string>();

/**
 * 为用户创建或获取持久化卷
 */
async function getOrCreateUserVolume(userId: string): Promise<string> {
  // 检查缓存
  const cachedVolume = userVolumes.get(userId);
  if (cachedVolume) {
    return cachedVolume;
  }

  const docker = getDocker();
  const volumeName = `pm-user-${userId}`;

  try {
    // 检查卷是否已存在
    const volume = docker.getVolume(volumeName);
    await volume.inspect();
    console.log(`📦 使用现有用户卷：${volumeName}`);
    userVolumes.set(userId, volumeName);
    return volumeName;
  } catch (error) {
    // 卷不存在，创建新卷
    console.log(`📦 创建用户持久化卷：${volumeName}`);
    await docker.createVolume({
      Name: volumeName,
      Labels: {
        'managed-by': 'product-manager',
        'user-id': userId,
        'purpose': 'user-home'
      }
    });
    userVolumes.set(userId, volumeName);
    return volumeName;
  }
}

/**
 * 为用户创建沙箱容器
 */
export async function createSandbox(
  sessionId: string,
  userId: string,
  project: string,
  cwd: string
): Promise<{ container: Docker.Container; stream: NodeJS.ReadWriteStream }> {

  // 确保本地项目目录存在
  if (!fs.existsSync(cwd)) {
    fs.mkdirSync(cwd, { recursive: true });
  }

  // 获取用户持久化卷
  const userVolumeName = await getOrCreateUserVolume(userId);

  // 获取用户自定义环境变量
  const userEnvVars = await getUserEnvVars(userId);

  // 获取 Docker 客户端
  const docker = getDocker();

  // 将 Windows 路径转换为 Docker 可识别的格式
  const dockerPath = convertToDockerPath(cwd);

  console.log(`📦 创建沙箱：user=${userId}, project=${project}, cwd=${dockerPath}, volume=${userVolumeName}`);

  try {
    // 创建容器
    const container = await docker.createContainer({
      Image: process.env.SANDBOX_IMAGE || 'pm-sandbox:latest',
      Cmd: ['/bin/bash'],
      Tty: true,
      OpenStdin: true,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,

      // 资源限制
      HostConfig: {
        Memory: parseMemoryLimit(process.env.SANDBOX_MEMORY_MB || '2048'),
        MemorySwap: parseMemoryLimit(process.env.SANDBOX_MEMORY_MB || '2048'),
        NanoCpus: 1 * 10 ** 9,  // 1 CPU 核心
        PidsLimit: 200,

        // 挂载用户项目目录和持久化卷
        Binds: [
          `${dockerPath}:/workspace:rw`,
          `${userVolumeName}:/root:rw`  // 挂载用户主目录，保存配置和下载
        ],

        // 安全限制
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges'],
        NetworkMode: 'bridge',
        AutoRemove: true,
      },

      // 环境变量
      Env: [
        `USER_ID=${userId}`,
        `PROJECT_NAME=${project}`,
        `HOME=/root`,
        'TERM=xterm-256color',
        'LANG=C.UTF-8',
        // 注入用户自定义环境变量
        ...Object.entries(userEnvVars).map(([k, v]) => `${k}=${v}`),
      ],

      // 标签
      Labels: {
        'managed-by': 'product-manager',
        'user-id': userId,
        'session-id': sessionId,
        'project': project,
      },
    });

    // 启动容器
    await container.start();

    // 在容器内执行 bash 并获取流
    const exec = await container.exec({
      Cmd: ['/bin/bash', '-l'],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Env: [
        'TERM=xterm-256color',
        `PROJECT_DIR=/workspace`,
      ],
    });

    const stream = await exec.start({
      hijack: true,
      stdin: true,
    });

    // 记录会话
    const session: SandboxSession = {
      container,
      execStream: stream,
      userId,
      project,
      sessionId,
      createdAt: new Date(),
      lastActiveAt: new Date(),
      volumeName: userVolumeName,
    };

    sandboxSessions.set(sessionId, session);

    console.log(`✅ 沙箱已创建：session=${sessionId}`);

    return { container, stream };

  } catch (error) {
    console.error('❌ 创建沙箱失败:', error);
    throw error;
  }
}

/**
 * 附加到现有沙箱会话
 */
export function getSandboxStream(sessionId: string): NodeJS.ReadWriteStream | null {
  const session = sandboxSessions.get(sessionId);
  if (!session) {
    return null;
  }

  // 更新最后活动时间
  session.lastActiveAt = new Date();

  return session.execStream;
}

/**
 * 更新沙箱活动时间
 */
export function updateSandboxActivity(sessionId: string) {
  const session = sandboxSessions.get(sessionId);
  if (session) {
    session.lastActiveAt = new Date();
  }
}

/**
 * 销毁沙箱
 */
export async function destroySandbox(sessionId: string): Promise<void> {
  const session = sandboxSessions.get(sessionId);
  if (!session) {
    return;
  }

  try {
    // 尝试优雅退出
    try {
      await session.container.stop({ t: 5 });
    } catch (error) {
      // 如果停止失败，强制 kill
      await session.container.kill();
    }

    sandboxSessions.delete(sessionId);
    console.log(`🗑️  沙箱已销毁：session=${sessionId} (volume ${session.volumeName} 保留)`);
  } catch (error) {
    console.error('销毁沙箱失败:', error);
    // 即使失败也要从会话列表中删除
    sandboxSessions.delete(sessionId);
  }
}

/**
 * 清理所有空闲沙箱 (超过指定时间无活动)
 */
export async function cleanupIdleSandboxes(idleTimeoutMinutes?: number): Promise<number> {
  const timeout = idleTimeoutMinutes || parseInt(process.env.SANDBOX_IDLE_TIMEOUT_MINUTES || '30');
  const now = new Date();
  let cleanedCount = 0;

  const sessionsToRemove: string[] = [];

  for (const [sessionId, session] of sandboxSessions.entries()) {
    const idleTime = now.getTime() - session.lastActiveAt.getTime();
    const idleMinutes = idleTime / (1000 * 60);

    if (idleMinutes > timeout) {
      sessionsToRemove.push(sessionId);
    }
  }

  // 清理空闲会话
  for (const sessionId of sessionsToRemove) {
    console.log(`⏰ 清理空闲沙箱：${sessionId}`);
    await destroySandbox(sessionId);
    cleanedCount++;
  }

  if (cleanedCount > 0) {
    console.log(`🧹 已清理 ${cleanedCount} 个空闲沙箱`);
  }

  return cleanedCount;
}

/**
 * 获取活跃沙箱数量
 */
export function getActiveSandboxCount(): number {
  return sandboxSessions.size;
}

/**
 * 获取所有活跃沙箱信息
 */
export function getAllSandboxSessions(): Map<string, SandboxSession> {
  return new Map(sandboxSessions);
}

/**
 * 从数据库获取用户环境变量
 * TODO: 后续实现数据库读取和解密
 */
async function getUserEnvVars(userId: string): Promise<Record<string, string>> {
  // 暂时返回空，后续从数据库读取
  // 格式：{ OPENAI_API_KEY: 'sk-xxx', QWEN_API_KEY: 'dashscope-xxx' }
  return {};
}

/**
 * 将 Windows 路径转换为 Docker 可识别的格式
 * Windows: F:\js-vue-project\productManager\axure\users\xxx\projects
 * Docker: /f/js-vue-project/productManager/axure/users/xxx/projects
 */
function convertToDockerPath(windowsPath: string): string {
  // 如果已经是 Unix 路径，直接返回
  if (!windowsPath.includes(':\\')) {
    return windowsPath;
  }

  // 转换 Windows 路径
  const [drive, ...pathParts] = windowsPath.split('\\');
  const driveLetter = drive.charAt(0).toLowerCase();
  const unixPath = '/' + driveLetter + '/' + pathParts.join('/');

  return unixPath;
}

/**
 * 解析内存限制 (MB → Bytes)
 */
function parseMemoryLimit(mbString: string): number {
  const mb = parseInt(mbString);
  return mb * 1024 * 1024;
}

// 启动定时清理任务 (每 10 分钟执行一次)
const cleanupInterval = setInterval(() => {
  cleanupIdleSandboxes().catch(error => {
    console.error('定时清理沙箱失败:', error);
  });
}, 10 * 60 * 1000); // 10 分钟

// 防止阻止进程退出
cleanupInterval.unref();

// 导出供测试使用
export { sandboxSessions };
